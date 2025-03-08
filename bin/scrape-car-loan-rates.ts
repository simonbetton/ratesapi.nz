import { load, type CheerioAPI } from "cheerio";
import { type Element } from "domhandler";
import ora from "ora";
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
import { hasDataChanged, loadFromD1, saveToD1 } from "./utils";

const config: {
  tableSelector: string;
  tableColumnHeaders: string[];
  alternativeSpecialProductNames: string[];
} = {
  tableSelector: "#interest_financial_datatable tbody tr",
  tableColumnHeaders: [
    // These are the headers for the rate table columns
    "Plan",
    "Notes",
    "Interest rate %",
  ],
  alternativeSpecialProductNames: [],
};

const log = createLogger("scrape-car-loan-rates");
const interestScraperAPI = InterestScraperAPI();

// The main function to scrape and save car loan rates
async function main() {
  // Load current rates from D1
  let currentRates: CarLoanRates | null = null;
  const loading = ora("Loading current data from D1").start();
  try {
    currentRates = await loadFromD1<CarLoanRates>("car-loan-rates");
    loading.succeed("Loaded current data").stop();
  } catch (error) {
    loading.fail("Failed to load current data").stop();
    log.error({ error }, "Failed to load current data");
    // Continue with the process even if loading fails
  }

  // Scrape new data
  let data: string = "";
  const gather = ora("Scraping car loan rates").start();
  try {
    const response = await interestScraperAPI.getCarLoanRatesPage();
    if (!response) {
      throw new Error(`Failed to fetch car loan rates`);
    }
    data = response;
    gather.succeed("Scraped car loan rates").stop();
  } catch (error) {
    gather.fail("Failed to scrape car loan rates").stop();
    log.error({ error }, "Failed to scrape car loan rates");
    return;
  }

  // Extract and validate data
  let validatedModel: CarLoanRates;
  const handle = ora("Extracting and Validating").start();
  try {
    const $ = load(data);
    const unvalidatedData = getModelExtractedFromDOM($);
    validatedModel = CarLoanRates.parse({
      type: "CarLoanRates",
      data: unvalidatedData,
      lastUpdated: new Date().toISOString(),
    }) as CarLoanRates;
    handle.succeed("Extracted and Validated").stop();
  } catch (error) {
    handle.fail("Failed to extract and/or validate").stop();
    log.error({ error }, "Failed to extract and/or validate");
    throw error;
  }

  // Check if the rates have changed
  if (currentRates && !hasDataChanged(validatedModel, currentRates)) {
    const noChange = ora("No changes detected").start();
    noChange.succeed("No changes detected").stop();
    return;
  }

  // Save new data to D1 database
  const saveDb = ora("Saving data to D1").start();
  try {
    // Save to D1 database
    const saved = await saveToD1(validatedModel, "car-loan-rates");
    
    saveDb.succeed(saved ? "Data saved to D1 database" : "Failed to save to D1").stop();
  } catch (error) {
    saveDb.fail("Failed to save data").stop();
    log.error({ error }, "Failed to save data");
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
