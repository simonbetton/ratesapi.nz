/* eslint-disable no-console */
import { load, type CheerioAPI } from "cheerio";
import { type Element } from "domhandler";
import ora from "ora";
import { generateId } from "../src/lib/generate-id";
import { InterestScraperAPI } from "../src/lib/interest-scraper-api";
import {
  MortgageRates,
  isRateTerm,
  type Institution,
  type Product,
  type Rate,
  type RateTerm,
} from "../src/models/mortgage-rates";
import { hasDataChanged, loadFromD1, saveToD1 } from "./utils";

const config: {
  tableSelector: string;
  tableColumnHeaders: RateTerm[];
  alternativeSpecialProductNames: string[];
} = {
  tableSelector: "#interest_financial_datatable tbody tr",
  tableColumnHeaders: [
    // These are the headers for the rate table columns
    "Variable floating",
    "6 months",
    "1 year",
    "2 years",
    "3 years",
    "4 years",
    "5 years",
  ],
  alternativeSpecialProductNames: [
    "Special LVR under 80%",
    "Special - Classic",
    "Special LVR <80%",
    "Special LVR < 80%",
  ],
};

const interestScraperAPI = InterestScraperAPI();

// The main function to scrape and save mortgage rates
async function main() {
  // Load current rates from D1
  let currentRates: MortgageRates | null = null;
  const loading = ora("Loading current data from D1").start();
  try {
    currentRates = await loadFromD1<MortgageRates>("mortgage-rates");
    loading.succeed("Loaded current data").stop();
  } catch (error) {
    loading.fail("Failed to load current data").stop();
    console.error("Failed to load current data", error);
    // Continue with the process even if loading fails
  }

  // Scrape new data
  let data: string = "";
  const gather = ora("Scraping mortgage rates").start();
  try {
    const response = await interestScraperAPI.getMortgageRatesPage();
    if (!response) {
      throw new Error(`Failed to fetch mortgage rates`);
    }
    data = response;
    gather.succeed("Scraped mortgage rates").stop();
  } catch (error) {
    gather.fail("Failed to scrape mortgage rates").stop();
    console.error("Failed to scrape mortgage rates", error);
    return;
  }

  // Extract and validate data
  let validatedModel: MortgageRates;
  const handle = ora("Extracting and Validating").start();
  try {
    const $ = load(data);
    const unvalidatedData = getModelExtractedFromDOM($);
    validatedModel = MortgageRates.parse({
      type: "MortgageRates",
      data: unvalidatedData,
      lastUpdated: new Date().toISOString(),
    }) as MortgageRates;
    handle.succeed("Extracted and Validated").stop();
  } catch (error) {
    handle.fail("Failed to extract and/or validate").stop();
    console.error("Failed to extract and/or validate", error);
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
    const saved = await saveToD1(validatedModel, "mortgage-rates");
    
    saveDb.succeed(saved ? "Data saved to D1 database" : "Failed to save to D1").stop();
  } catch (error) {
    saveDb.fail("Failed to save data").stop();
    console.error("Failed to save data", error);
    return;
  }
}
main().catch(console.error);

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
        ...asRatesForProduct(currentInstitution, product, $, cells),
      ];
      sortProductRatesByTermInMonths(product.rates);
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

function asRatesForProduct(
  institution: Institution,
  product: Product,
  $: CheerioAPI,
  cells: Element[],
): Rate[] {
  const rates: Rate[] = [];

  for (let i = 2; i < cells.length; i++) {
    const cell = cells[i];
    const colspan = $(cell).hasClass("special-line");
    // Check for "18 months" lines. These are spanned across multiple columns 🤷
    if (colspan) {
      const specialRate = getSpecialRate(
        $(cell).text().replace(/\n|\r/g, "").trim(),
      );
      if (specialRate && isRateTerm(specialRate.term) && product.name) {
        rates.push(
          asRate(institution, product.name, specialRate.term, specialRate.rate),
        );
      }
    } else {
      const rate = $(cell).text().trim();
      const term = config.tableColumnHeaders[i - 2]?.replace(/\n|\r/g, ""); // Need to zero-base the index back to the tableColumnHeaders array
      if (rate && term && isRateTerm(term) && product.name) {
        rates.push(asRate(institution, product.name, term, rate));
      }
    }
  }

  return rates;
}

function asRate(
  institution: Institution,
  productName: string,
  term: RateTerm,
  rate: string,
): Rate {
  return {
    id: generateId(["rate", institution.name, productName, term]),
    term,
    termInMonths: convertTermToMonthsNumber(term),
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

function getSpecialRate(text: string): { term: string; rate: string } | null {
  const matches = text.match(/(\d+ months) = (.+)/);
  if (matches && matches.length === 3 && matches[1] && matches[2]) {
    return { term: matches[1], rate: matches[2] };
  }
  return null;
}

function normalizeProductName(name: string) {
  if (config.alternativeSpecialProductNames.includes(name)) {
    return "Special";
  }
  return name;
}

function sortProductRatesByTermInMonths(rates: Rate[]) {
  rates.sort((a, b) => {
    return (a.termInMonths ?? 0) - (b.termInMonths ?? 0);
  });
}

function convertTermToMonthsNumber(term: RateTerm): number | null {
  // If term has "months" in it, parse the number of months
  const matches = term.match(/(\d+) months?/);
  if (matches && matches.length === 2 && matches[1]) {
    return parseInt(matches[1]);
  }
  // If term has "year" in it, parse the number of years
  const matchesYears = term.match(/(\d+) years?/);
  if (matchesYears && matchesYears.length === 2 && matchesYears[1]) {
    return parseInt(matchesYears[1]) * 12;
  }
  return null;
}
