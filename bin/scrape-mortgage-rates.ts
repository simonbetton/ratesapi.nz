import * as cheerio from "cheerio";
import { writeFileSync } from "fs";
import { createHash } from "hono/utils/crypto";
import ora from "ora";
import {
  Institution,
  MortgageRates,
  Product,
  Rate,
  RateTerm,
  isRateTerm,
} from "../src/models/mortgage-rates";

const config: {
  url: string;
  tableSelector: string;
  tableColumnHeaders: RateTerm[];
  alternativeSpecialProductNames: string[];
  outputFilePath: string;
} = {
  url: "https://www.interest.co.nz/borrowing",
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
  outputFilePath: "data/mortgage-rates.json",
};

async function main() {
  let data: string = "";
  const gather = ora("Scraping mortgage rates").start();
  try {
    const response = await fetchWithTimeout(config.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${config.url}`);
    }
    data = await response.text();
    gather.succeed("Scraped mortgage rates").stop();
  } catch (error) {
    gather.fail("Failed to scrape mortgage rates").stop();
  }

  let validatedModel: MortgageRates = [];
  const handle = ora("Extracting and Validating").start();
  try {
    const $ = cheerio.load(data);
    const unvalidatedModel = await getModelExtractedFromDOM($);
    validatedModel = MortgageRates.parse(unvalidatedModel);
    handle.succeed("Extracted and Validated").stop();
  } catch (error) {
    handle.fail("Failed to extract and/or validate").stop();
  }

  const save = ora("Saving to file").start();
  try {
    saveDataToFile(validatedModel);
    save.succeed("Saved to local file").stop();
  } catch (error) {
    save.fail("Failed to save to local file").stop();
  }
}
main().catch(console.error);

async function getModelExtractedFromDOM(
  $: cheerio.CheerioAPI
): Promise<Institution[]> {
  const institutions: Institution[] = [];
  const rows = $(config.tableSelector);
  let currentInstitution: Institution | null = null;

  for await (const row of rows) {
    const cells = Array.from($(row).find("td"));
    const isPrimaryRow = $(row).hasClass("primary_row");
    if (isPrimaryRow) {
      currentInstitution = await createInstitution($, cells[0]);
      institutions.push(currentInstitution);
    }
    if (currentInstitution) {
      const productName = getProductName($, cells);
      const product = await findOrCreateProduct(
        currentInstitution,
        productName
      );
      product.rates = [
        ...product.rates,
        ...(await createRatesForProduct(currentInstitution, $, cells)),
      ];
      sortProductRatesByTerm(product.rates);
    }
  }

  return institutions;
}

async function findOrCreateProduct(
  institution: Institution,
  productName: string
): Promise<Product> {
  let product = institution.products.find((p) => p.name === productName);
  if (!product) {
    product = {
      id: await generateKeyFor("product", productName, institution.name),
      name: productName,
      rates: [],
    };
    institution.products.push(product);
  }
  return product;
}

async function createInstitution(
  $: cheerio.CheerioAPI,
  cell: cheerio.Element
): Promise<Institution> {
  const name = getInstitutionName($, cell);
  return {
    id: await generateKeyFor("institution", name),
    name,
    products: [],
  };
}

async function createRatesForProduct(
  institution: Institution,
  $: cheerio.CheerioAPI,
  cells: cheerio.Element[]
): Promise<Rate[]> {
  const rates: Rate[] = [];

  for (let i = 2; i < cells.length; i++) {
    const cell = cells[i];
    const colspan = $(cell).hasClass("special-line");
    // Check for "18 months" lines. These are spanned across multiple columns 🤷
    if (colspan) {
      const specialRate = getSpecialRate(
        $(cell).text().replace(/\n|\r/g, "").trim()
      );
      if (specialRate && isRateTerm(specialRate.term)) {
        rates.push(
          await createRate(institution, specialRate.term, specialRate.rate)
        );
      }
    } else {
      const rate = $(cell).text().trim();
      const term = config.tableColumnHeaders[i - 2].replace(/\n|\r/g, ""); // Need to zero-base the index back to the tableColumnHeaders array
      if (rate && isRateTerm(term)) {
        rates.push(await createRate(institution, term, rate));
      }
    }
  }

  return rates;
}

async function createRate(
  institution: Institution,
  term: RateTerm,
  rate: string
): Promise<Rate> {
  return {
    id: await generateKeyFor("rate", term, institution.name),
    term,
    termInMonths: convertTermToMonths(term),
    rate: parseFloat(rate),
  };
}

function getInstitutionName(
  $: cheerio.CheerioAPI,
  cell: cheerio.Element
): string {
  const imgElement = $(cell).find("img");
  if (imgElement) {
    return imgElement.attr("alt")?.trim() ?? $(cell).text().trim(); // Use alt text if image exists
  } else {
    return $(cell).text().trim(); // Fallback to innerText
  }
}

function getProductName(
  $: cheerio.CheerioAPI,
  cells: cheerio.Element[]
): string {
  return normalizeProductName($(cells[1]).text().trim());
}

function normalizeProductName(name: string) {
  if (config.alternativeSpecialProductNames.includes(name)) {
    return "Special";
  }
  return name;
}

function getSpecialRate(text: string): { term: string; rate: string } | null {
  const matches = text.match(/(\d+ months) = (.+)/);
  if (matches && matches.length === 3) {
    return { term: matches[1], rate: matches[2] };
  }
  return null;
}

function sortProductRatesByTerm(rates: Rate[]) {
  rates.sort((a, b) => {
    return (a.termInMonths ?? 0) - (b.termInMonths ?? 0);
  });
}

function convertTermToMonths(term: RateTerm): number | null {
  // If term has "months" in it, parse the number of months
  const matches = term.match(/(\d+) months?/);
  if (matches && matches.length === 2) {
    return parseInt(matches[1]);
  }
  // If term has "year" in it, parse the number of years
  const matchesYears = term.match(/(\d+) years?/);
  if (matchesYears && matchesYears.length === 2) {
    return parseInt(matchesYears[1]) * 12;
  }
  return null;
}

async function generateKeyFor(
  prefix: "rate" | "product" | "institution",
  input: string,
  mix?: string
): Promise<string> {
  return `${prefix}:${
    (await createHash(`${mix}:${input}`, { name: "SHA-1", alias: "SHA1" })) ??
    "unknown"
  }`;
}

function saveDataToFile(data: Institution[]) {
  writeFileSync(config.outputFilePath, JSON.stringify(data, null, 2));
}

async function fetchWithTimeout(
  resource: string,
  options: RequestInit = {},
  timeout: number = 2000
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(resource, {
    ...options,
    signal: controller.signal, // Pass the abort signal to the fetch call
  }).catch((error) => {
    if (error.name === "AbortError") {
      throw new Error("Fetch request timed out");
    } else {
      throw error; // Rethrow other errors for caller to handle
    }
  });

  clearTimeout(id); // Clear the timeout if the fetch completes in time
  return response;
}
