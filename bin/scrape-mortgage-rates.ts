import axios from "axios";
import * as cheerio from "cheerio";
import { writeFileSync } from "fs";
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
  ],
  outputFilePath: "data/mortgage-rates.json",
};

async function main() {
  try {
    const { data } = await axios.get(config.url);
    const $ = cheerio.load(data);
    const institutions = modelExtractedFromDOM($);
    saveDataToFile(MortgageRates.parse(institutions));
  } catch (error) {
    console.error("Error during scraping or file writing:", error);
  }
}
main().catch(console.error);

function modelExtractedFromDOM($: cheerio.CheerioAPI): Institution[] {
  const institutions: Institution[] = [];
  const rows = $(config.tableSelector);

  let currentInstitution: Institution;

  rows.each((_, row) => {
    const cells = Array.from($(row).find("td"));
    const isPrimaryRow = $(row).hasClass("primary_row");
    if (isPrimaryRow) {
      currentInstitution = createInstitution($, cells[0]);
      institutions.push(currentInstitution);
    }
    if (currentInstitution) {
      const productName = getProductName($, cells);
      const product = findOrCreateProduct(currentInstitution, productName);
      product.rates = [...product.rates, ...getRatesForProduct($, cells)];
      sortProductRatesByTerm(product.rates);
    }
  });

  return institutions;
}

function findOrCreateProduct(
  institution: Institution,
  productName: string
): Product {
  let product = institution.products.find((p) => p.name === productName);
  if (!product) {
    product = {
      name: productName,
      rates: [],
    };
    institution.products.push(product);
  }
  return product;
}

function createInstitution(
  $: cheerio.CheerioAPI,
  cell: cheerio.Element
): Institution {
  return {
    name: getInstitutionName($, cell),
    products: [],
  };
}

function getRatesForProduct(
  $: cheerio.CheerioAPI,
  cells: cheerio.Element[]
): Rate[] {
  const rates: Rate[] = [];

  cells.slice(2).forEach((cell, i) => {
    // Check for "18 months" lines. These are spanned across multiple columns 🤷
    if ($(cell).attr("colspan")) {
      const specialRateText = $(cell).text().trim();
      const matches = specialRateText.match(/(\d+ months) = (.+)/);
      if (matches && matches.length === 3) {
        const term = matches[1];
        const rate = matches[2];
        if (term && rate && isRateTerm(term)) {
          rates.push({ term, rate: parseFloat(rate) });
        }
      }
    } else {
      const rate = $(cell).text().trim();
      if (rate && isRateTerm(config.tableColumnHeaders[i])) {
        rates.push({
          term: config.tableColumnHeaders[i],
          rate: parseFloat(rate),
        });
      }
    }
  });

  return rates;
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

function sortProductRatesByTerm(rates: Rate[]) {
  rates.sort((a, b) => {
    return (
      config.tableColumnHeaders.indexOf(a.term) -
      config.tableColumnHeaders.indexOf(b.term)
    );
  });
}

function saveDataToFile(data: Institution[]) {
  writeFileSync(config.outputFilePath, JSON.stringify(data, null, 2));
}
