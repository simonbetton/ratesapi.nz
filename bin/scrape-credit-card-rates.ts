/* eslint-disable no-console */
import { load, type CheerioAPI } from "cheerio";
import { type Element } from "domhandler";
import ora from "ora";
import { generateId } from "../src/lib/generate-id";
import { InterestScraperAPI } from "../src/lib/interest-scraper-api";
import { CreditCardRates, type Issuer, type Plan } from "../src/models";
import { hasDataChanged, loadFromD1, saveToD1 } from "./utils";

const config: {
  tableSelector: string;
  tableColumnHeaders: string[];
  alternativeSpecialPlanNames: string[];
} = {
  tableSelector: "#interest_financial_datatable tbody tr",
  tableColumnHeaders: [
    // These are the headers for the rate table columns
    "Plan",
    "Interest free period",
    "Fee primary $",
    "Balance transfer %",
    "Balance transfer period",
    "Cash Adv %",
    "Purchases %",
  ],
  alternativeSpecialPlanNames: [],
};

const interestScraperAPI = InterestScraperAPI();

// The main function to scrape and save credit card rates
async function main() {
  // Load current rates from D1
  let currentRates: CreditCardRates | null = null;
  const loading = ora("Loading current data from D1").start();
  try {
    currentRates = await loadFromD1<CreditCardRates>("credit-card-rates");
    loading.succeed("Loaded current data").stop();
  } catch (error) {
    loading.fail("Failed to load current data").stop();
    console.error("Failed to load current data", error);
    // Continue with the process even if loading fails
  }

  // Scrape new data
  let data: string = "";
  const gather = ora("Scraping credit card rates").start();
  try {
    const response = await interestScraperAPI.getCreditCardRatesPage();
    if (!response) {
      throw new Error(`Failed to fetch credit card rates`);
    }
    data = response;
    gather.succeed("Scraped credit card rates").stop();
  } catch (error) {
    gather.fail("Failed to scrape credit card rates").stop();
    console.error("Failed to scrape credit card rates", error);
    return;
  }

  // Extract and validate data
  let validatedModel: CreditCardRates;
  const handle = ora("Extracting and Validating").start();
  try {
    const $ = load(data);
    const unvalidatedData = getModelExtractedFromDOM($);
    validatedModel = CreditCardRates.parse({
      type: "CreditCardRates",
      data: unvalidatedData,
      lastUpdated: new Date().toISOString(),
    }) as CreditCardRates;
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
    const saved = await saveToD1(validatedModel, "credit-card-rates");
    
    saveDb.succeed(saved ? "Data saved to D1 database" : "Failed to save to D1").stop();
  } catch (error) {
    saveDb.fail("Failed to save data").stop();
    console.error("Failed to save data", error);
    return;
  }
}
main().catch(console.error);

function getModelExtractedFromDOM($: CheerioAPI): Issuer[] {
  const issuers: Issuer[] = [];
  const rows = $(config.tableSelector);
  let currentIssuer: Issuer | null = null;

  for (const row of rows) {
    const cells = Array.from($(row).find("td"));
    const isPrimaryRow = $(row).hasClass("primary_row");
    if (isPrimaryRow && cells[0]) {
      currentIssuer = asIssuer($, cells[0]);
      issuers.push(currentIssuer);
    }
    if (currentIssuer) {
      addPlanTo(currentIssuer, $, cells);
    }
  }

  return issuers;
}

function addPlanTo(issuer: Issuer, $: CheerioAPI, cells: Element[]) {
  const productName = getPlanName($, cells);
  const interestFreePeriodInMonths =
    parseFloat($(cells[2]).text().trim()) || null;
  const primaryFeeNZD = parseFloat($(cells[3]).text().trim()) || null;
  const balanceTransferRate = parseFloat($(cells[4]).text().trim()) || null;
  const balanceTransferPeriod =
    String($(cells[5]).text().trim())
      .replace("mths", "months")
      .replace("bal tsfrd", "balance transferred") || null;
  const cashAdvanceRate = parseFloat($(cells[6]).text().trim()) || null;
  const purchaseRate = parseFloat($(cells[7]).text().trim()) || null;

  const plan: Plan = {
    id: generateId(["plan", issuer.name, productName]),
    name: productName,
    interestFreePeriodInMonths,
    primaryFeeNZD,
    balanceTransferRate,
    balanceTransferPeriod,
    cashAdvanceRate,
    purchaseRate,
  };

  issuer.plans.push(plan);
}

function asIssuer($: CheerioAPI, cell: Element): Issuer {
  const name = getIssuerName($, cell);
  return {
    id: generateId(["issuer", name]),
    name,
    plans: [],
  };
}

function getIssuerName($: CheerioAPI, cell: Element): string {
  const imgElement = $(cell).find("img");
  if (imgElement) {
    return imgElement.attr("alt")?.trim() ?? $(cell).text().trim(); // Use alt text if image exists
  }
  return $(cell).text().trim(); // Fallback to innerText
}

function getPlanName($: CheerioAPI, cells: Element[]): string {
  return normalizePlanName($(cells[1]).text().trim());
}

function normalizePlanName(name: string) {
  if (config.alternativeSpecialPlanNames.includes(name)) {
    return "Special";
  }
  return name
    .replace(/airpoint /i, "Airpoints ")
    .replace(/onesmart/i, "OneSmart")
    .replace("FarmersCard", "Farmers Finance Card")
    .replace("Warehose", "Warehouse"); // Typo in the source
}
