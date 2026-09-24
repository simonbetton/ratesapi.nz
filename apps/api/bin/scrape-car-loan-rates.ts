import { type CheerioAPI, load } from "cheerio";
import { type Element } from "domhandler";
import ora from "ora";
import { generateId } from "../src/lib/generate-id";
import { InterestScraperAPI } from "../src/lib/interest-scraper-api";
import { isTruthy } from "../src/lib/is-truthy";
import { createLogger } from "../src/lib/logging";
import { parseSchema } from "../src/lib/schema";
import { toTitleFormat } from "../src/lib/transforms";
import {
  type CarLoanInstitution,
  type CarLoanProduct,
  type CarLoanRate,
  CarLoanRates,
} from "../src/models/car-loan-rates";
import { assertScrapeHasRates, assertTableHasRows } from "./scrape-guards";
import { runScrape } from "./scrape-runner";
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
  const outcome = await runScrape<CarLoanRates>({
    loadCurrent: async () => {
      const loading = ora("Loading current data from D1").start();
      try {
        const currentRates = await loadFromD1("car-loan-rates", CarLoanRates);
        loading.succeed("Loaded current data").stop();
        return currentRates;
      } catch (error) {
        loading.fail("Failed to load current data").stop();
        log.error({ error }, "Failed to load current data");
        throw error;
      }
    },
    fetchHtml: async () => {
      const gather = ora("Scraping car loan rates").start();
      try {
        const response = await interestScraperAPI.getCarLoanRatesPage();
        if (!response) {
          throw new Error(`Failed to fetch car loan rates`);
        }
        gather.succeed("Scraped car loan rates").stop();
        return response;
      } catch (error) {
        gather.fail("Failed to scrape car loan rates").stop();
        log.error({ error }, "Failed to scrape car loan rates");
        throw error;
      }
    },
    parseAndValidate: (data) => {
      const handle = ora("Extracting and Validating").start();
      try {
        const $ = load(data);
        assertTableHasRows(
          $(config.tableSelector).length,
          config.tableSelector,
        );
        const unvalidatedData = getModelExtractedFromDOM($);
        const validatedModel = parseSchema(CarLoanRates, {
          type: "CarLoanRates",
          data: unvalidatedData,
          lastUpdated: new Date().toISOString(),
        });
        assertScrapeHasRates(validatedModel);
        handle
          .succeed(
            `Extracted and Validated ${validatedModel.data.length} results`,
          )
          .stop();
        return validatedModel;
      } catch (error) {
        handle.fail("Failed to extract and/or validate").stop();
        log.error({ error }, "Failed to extract and/or validate");
        throw error;
      }
    },
    hasChanged: hasDataChanged,
    save: async (validatedModel) => {
      const saveDb = ora("Saving data to D1").start();
      try {
        const saved = await saveToD1(validatedModel, "car-loan-rates");
        if (saved) {
          saveDb.succeed("Data saved to D1 database").stop();
        } else {
          saveDb.fail("Failed to save to D1").stop();
        }
        return saved;
      } catch (error) {
        saveDb.fail("Failed to save data").stop();
        log.error({ error }, "Failed to save data");
        throw error;
      }
    },
  });

  if (outcome.status === "unchanged") {
    const noChange = ora("No changes detected").start();
    noChange.succeed("No changes detected").stop();
  }
}
main().catch((error) => {
  log.error({ error }, "Scraper failed");
  process.exitCode = 1;
});

function getModelExtractedFromDOM($: CheerioAPI): CarLoanInstitution[] {
  const institutions: CarLoanInstitution[] = [];
  const rows = $(config.tableSelector);
  let currentInstitution: CarLoanInstitution | null = null;

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

function asProduct(
  institution: CarLoanInstitution,
  productName: string,
): CarLoanProduct {
  let product = institution.products.find(
    (p: CarLoanProduct) => p.name === productName,
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

function asInstitution($: CheerioAPI, cell: Element): CarLoanInstitution {
  const name = getInstitutionName($, cell);
  return {
    id: generateId(["institution", name]),
    name,
    products: [],
  };
}

function asRateForProduct(
  institution: CarLoanInstitution,
  product: CarLoanProduct,
  $: CheerioAPI,
  cells: Element[],
): CarLoanRate | undefined {
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
  institution: CarLoanInstitution,
  productName: string,
  plan: string,
  condition: string,
  rate: string,
): CarLoanRate {
  return {
    id: generateId(["rate", institution.name, productName, plan, condition]),
    plan: toTitleFormat(plan) || null,
    condition: toTitleFormat(condition) || null,
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
  return toTitleFormat(normalizeProductName($(cells[1]).text().trim())) ?? "";
}

function normalizeProductName(name: string) {
  if (config.alternativeSpecialProductNames.includes(name)) {
    return "Special";
  }
  return name;
}

function sortProductRatesById(rates: CarLoanRate[]) {
  rates.sort((a, b) => {
    return a.id.localeCompare(b.id);
  });
}
