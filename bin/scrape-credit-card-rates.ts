import { CheerioAPI, load, Element } from "cheerio";
import ora from "ora";
import { generateId } from "../src/utils/generate-id";
import CreditCardRatesFromJson from "../data/credit-card-rates.json";
import { fetchWithTimeout, hasDataChanged, saveDataToFile } from "./utils";
import { CreditCardRates } from "../src/models/credit-card-rates";
import { Issuer } from "../src/models/issuer";
import { Plan } from "../src/models/plan";

const config: {
  url: string;
  tableSelector: string;
  tableColumnHeaders: string[];
  alternativeSpecialPlanNames: string[];
  outputFilePath: string;
} = {
  url: "https://www.interest.co.nz/borrowing/credit-cards",
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
  outputFilePath: "data/credit-card-rates.json",
};

async function main() {
  let data: string = "";
  const gather = ora("Scraping credit card rates").start();
  try {
    const response = await fetchWithTimeout(config.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${config.url}`);
    }
    data = await response.text();
    gather.succeed("Scraped credit card rates").stop();
  } catch (error) {
    gather.fail("Failed to scrape credit card rates").stop();
    console.error("Failed to scrape credit card rates", error);
    return;
  }

  let validatedModel: CreditCardRates;
  const handle = ora("Extracting and Validating").start();
  try {
    const $ = load(data);
    const unvalidatedData = getModelExtractedFromDOM($);
    validatedModel = CreditCardRates.parse({
      type: "CreditCardRates",
      data: unvalidatedData,
      lastUpdated: new Date().toISOString(),
    }) as CreditCardRates; // We have to cast because Zod type inference does not create string literal types from .regex(). It's safe here because
    handle.succeed("Extracted and Validated").stop();
  } catch (error) {
    handle.fail("Failed to extract and/or validate").stop();
    console.error("Failed to extract and/or validate", error);
    throw error;
  }

  // Check if the rates have changed
  // If they haven't, don't save to file
  // TODO: Fix this `as CreditCardRates` type casting
  if (
    !hasDataChanged(validatedModel, CreditCardRatesFromJson as CreditCardRates)
  ) {
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
    console.error("Failed to save to local file", error);
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
    if (isPrimaryRow) {
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
  } else {
    return $(cell).text().trim(); // Fallback to innerText
  }
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
