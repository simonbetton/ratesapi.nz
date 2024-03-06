import { load, type CheerioAPI, type Element } from "cheerio";
import ora from "ora";
import CarLoanRatesFromJson from "../data/car-loan-rates.json";
import { generateId } from "../src/lib/generate-id";
import { InterestScraperAPI } from "../src/lib/interest-scraper-api";
import { isTruthy } from "../src/lib/is-truthy";
import { createLogger } from "../src/lib/logging";
import {
  CarLoanRates,
  type Institution,
  type Product,
  type Rate,
} from "../src/models/car-loan-rates";
import { hasDataChanged, saveDataToFile } from "./utils";

const config: {
  tableSelector: string;
  tableColumnHeaders: string[];
  alternativeSpecialProductNames: string[];
  outputFilePath: string;
} = {
  tableSelector: "#interest_financial_datatable tbody tr",
  tableColumnHeaders: [
    // These are the headers for the rate table columns
    "Plan",
    "Notes",
    "Interest rate %",
  ],
  alternativeSpecialProductNames: [],
  outputFilePath: "data/car-loan-rates.json",
};

const log = createLogger("scrape-car-loan-rates");
const interestScraperAPI = InterestScraperAPI();

async function main() {
  let data: string = "";
  const gather = ora("Scraping car loan rates").start();
  try {
    const response = await interestScraperAPI.getCarLoanRatesPage();
    if (!response) {
      throw new Error(`Failed to fetch car loan rates`);
    }
    data = response;
    gather.succeed("Scraped car loan rates\n").stop();
  } catch (error) {
    gather.fail("Failed to scrape car loan rates\n").stop();
    log.error({ error }, "Failed to scrape car loan rates");
    return;
  }

  let validatedModel: CarLoanRates;
  const handle = ora("Extracting and Validating").start();
  try {
    const $ = load(data);
    const unvalidatedData = getModelExtractedFromDOM($);
    validatedModel = CarLoanRates.parse({
      type: "CarLoanRates",
      data: unvalidatedData,
      lastUpdated: new Date().toISOString(),
    }) as CarLoanRates; // We have to cast because Zod type inference does not create string literal types from .regex(). It's safe here because
    handle.succeed("Extracted and Validated").stop();
  } catch (error) {
    handle.fail("Failed to extract and/or validate").stop();
    log.error({ error }, "Failed to extract and/or validate");
    throw error;
  }

  // Check if the rates have changed
  // If they haven't, don't save to file
  // TODO: Fix this `as CarLoanRates` type casting
  if (!hasDataChanged(validatedModel, CarLoanRatesFromJson as CarLoanRates)) {
    const noChange = ora("No changes detected").start();
    noChange.succeed("No changes detected").stop();
    return;
  }

  const save = ora("Saving to file").start();
  try {
    saveDataToFile(validatedModel, config);
    save.succeed("Saved to local file").stop();
  } catch (error) {
    save.fail("Failed to save to local file").stop();
    log.error({ error }, "Failed to save to local file");
    return;
  }
}
main().catch(log.error);

function getModelExtractedFromDOM($: CheerioAPI): Institution[] {
  const institutions: Institution[] = [];
  const rows = $(config.tableSelector);
  let currentInstitution: Institution | null = null;

  for (const row of rows) {
    const cells = Array.from($(row).find("td"));
    const isPrimaryRow = $(row).hasClass("primary_row");
    if (isPrimaryRow && cells[0]) {
      currentInstitution = asInstitution($, cells[0]);
      institutions.push(currentInstitution);
    }
    if (currentInstitution) {
      const productName = getProductName($, cells);
      const product = asProduct(currentInstitution, productName);
      product.rates = [
        ...product.rates,
        asRateForProduct(currentInstitution, product, $, cells),
      ].filter(isTruthy);
      sortProductRatesById(product.rates);
    }
  }

  return institutions;
}

function asProduct(institution: Institution, productName: string): Product {
  let product = institution.products.find(
    (p: Product) => p.name === productName,
  );
  if (!product) {
    product = {
      id: generateId(["product", institution.name, productName]),
      name: productName,
      rates: [],
    };
    institution.products.push(product);
  }
  return product;
}

function asInstitution($: CheerioAPI, cell: Element): Institution {
  const name = getInstitutionName($, cell);
  return {
    id: generateId(["institution", name]),
    name,
    products: [],
  };
}

function asRateForProduct(
  institution: Institution,
  product: Product,
  $: CheerioAPI,
  cells: Element[],
): Rate | undefined {
  const remainingCells = cells.slice(2); // The first column is institution name and the second column is the product name – we don't need these for rates
  const plan = $(remainingCells[0]).text().trim();
  const condition = $(remainingCells[1]).text().trim();
  const rate = $(remainingCells[2]).text().trim();
  if (rate && product.name) {
    return asRate(institution, product.name, plan, condition, rate);
  }
  return undefined;
}

function asRate(
  institution: Institution,
  productName: string,
  plan: string,
  condition: string,
  rate: string,
): Rate {
  return {
    id: generateId(["rate", institution.name, productName, plan, condition]),
    plan: plan || null,
    condition: condition || null,
    rate: parseFloat(rate),
  };
}

function getInstitutionName($: CheerioAPI, cell: Element): string {
  const imgElement = $(cell).find("img");
  if (imgElement) {
    return imgElement.attr("alt")?.trim() ?? $(cell).text().trim(); // Use alt text if image exists
  }
  return $(cell).text().trim(); // Fallback to innerText
}

function getProductName($: CheerioAPI, cells: Element[]): string {
  return normalizeProductName($(cells[1]).text().trim());
}

function normalizeProductName(name: string) {
  if (config.alternativeSpecialProductNames.includes(name)) {
    return "Special";
  }
  return name;
}

function sortProductRatesById(rates: Rate[]) {
  rates.sort((a, b) => {
    return a.id.localeCompare(b.id);
  });
}
