import { type CheerioAPI, load } from "cheerio";
import { type Element } from "domhandler";
import ora from "ora";
import { generateId } from "../src/lib/generate-id";
import { InterestScraperAPI } from "../src/lib/interest-scraper-api";
import { isTruthy } from "../src/lib/is-truthy";
import { parseSchema } from "../src/lib/schema";
import { toTitleFormat } from "../src/lib/transforms";
import {
  type PersonalLoanInstitution,
  type PersonalLoanProduct,
  type PersonalLoanRate,
  PersonalLoanRates,
} from "../src/models/personal-loan-rates";
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

const interestScraperAPI = InterestScraperAPI();

// The main function to scrape and save personal loan rates
async function main() {
  const outcome = await runScrape<PersonalLoanRates>({
    loadCurrent: async () => {
      const loading = ora("Loading current data from D1").start();
      try {
        const currentRates = await loadFromD1(
          "personal-loan-rates",
          PersonalLoanRates,
        );
        loading.succeed("Loaded current data").stop();
        return currentRates;
      } catch (error) {
        loading.fail("Failed to load current data").stop();
        console.error("Failed to load current data", error);
        throw error;
      }
    },
    fetchHtml: async () => {
      const gather = ora("Scraping personal loan rates").start();
      try {
        const response = await interestScraperAPI.getPersonalLoanRatesPage();
        if (!response) {
          throw new Error("Failed to fetch personal loan rates");
        }
        gather.succeed("Scraped personal loan rates").stop();
        return response;
      } catch (error) {
        gather.fail("Failed to scrape personal loan rates").stop();
        console.error("Failed to scrape personal loan rates", error);
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
        const validatedModel = parseSchema(PersonalLoanRates, {
          type: "PersonalLoanRates",
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
        console.error("Failed to extract and/or validate", error);
        throw error;
      }
    },
    hasChanged: hasDataChanged,
    save: async (validatedModel) => {
      const saveDb = ora("Saving data to D1").start();
      try {
        const saved = await saveToD1(validatedModel, "personal-loan-rates");
        if (saved) {
          saveDb.succeed("Data saved to D1 database").stop();
        } else {
          saveDb.fail("Failed to save to D1").stop();
        }
        return saved;
      } catch (error) {
        saveDb.fail("Failed to save data").stop();
        console.error("Failed to save data", error);
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
  console.error(error);
  process.exitCode = 1;
});

function getModelExtractedFromDOM($: CheerioAPI): PersonalLoanInstitution[] {
  const institutions: PersonalLoanInstitution[] = [];
  const rows = $(config.tableSelector);
  let currentInstitution: PersonalLoanInstitution | null = null;

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
  institution: PersonalLoanInstitution,
  productName: string,
): PersonalLoanProduct {
  let product = institution.products.find(
    (p: PersonalLoanProduct) => p.name === productName,
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

function asInstitution($: CheerioAPI, cell: Element): PersonalLoanInstitution {
  const name = getInstitutionName($, cell);
  return {
    id: generateId(["institution", name]),
    name,
    products: [],
  };
}

function asRateForProduct(
  institution: PersonalLoanInstitution,
  product: PersonalLoanProduct,
  $: CheerioAPI,
  cells: Element[],
): PersonalLoanRate | undefined {
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
  institution: PersonalLoanInstitution,
  productName: string,
  plan: string,
  condition: string,
  rate: string,
): PersonalLoanRate {
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
  return toTitleFormat(normalizeProductName($(cells[1]).text().trim())) ?? "";
}

function normalizeProductName(name: string) {
  if (config.alternativeSpecialProductNames.includes(name)) {
    return "Special";
  }
  return name;
}

function sortProductRatesById(rates: PersonalLoanRate[]) {
  rates.sort((a, b) => {
    return a.id.localeCompare(b.id);
  });
}
