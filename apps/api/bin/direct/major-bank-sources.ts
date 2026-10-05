import {
  matchingTable,
  page,
  percentage,
  plainText,
  requireCount,
  requiredMatch,
  termMonths,
} from "./parsing";
import type { DirectSource, Observation } from "./types";

const asb =
  "https://www.asb.co.nz/home-loans-mortgages/interest-rates-fees.html";
const bnz =
  "https://www.bnz.co.nz/personal-banking/home-loans/compare-bnz-home-loan-rates";
const westpac =
  "https://www.westpac.co.nz/home-loans-mortgages/interest-rates/";
const greater =
  "https://www.westpac.co.nz/home-loans-mortgages/options/greater-choices-home-loan/";
const asbPersonal = "https://www.asb.co.nz/personal-loans";

function asbMortgage(pages: ReadonlyMap<string, string>): Observation[] {
  const rows = matchingTable(page(pages, asb), /^Term Interest Rate 6 month/u);
  const data = requireCount(rows.slice(1), 11);
  return data.map(([label, value]) => {
    let product = "Standard";
    let rateText = value ?? "";
    let termInMonths: number | null;
    let condition =
      "Minimum 20% equity; a low equity margin may apply below 20%.";
    if (label === "Housing Variable") {
      termInMonths = null;
      const [numeric, effective] = rateText.split("Effective on and from ");
      rateText = numeric?.trim() ?? "";
      if (effective) {
        condition += ` Effective on and from ${effective}`;
      }
    } else if (label?.startsWith("ASB Better Homes Top Up")) {
      product = "Better Homes Top Up";
      termInMonths = 36;
      condition =
        "Fixed for 36 months; existing ASB home loan customers, eligible purchases up to $80,000.";
    } else if (label?.startsWith("Back My Build Variable")) {
      product = "Back My Build";
      termInMonths = null;
      condition = "Closed to new applications.";
    } else if (label?.startsWith("ORBIT Home Loan")) {
      product = "Orbit";
      termInMonths = null;
      condition =
        "Orbit facilities documented before 31 October 2016 use Housing Variable instead.";
    } else {
      termInMonths = termMonths(label ?? "");
    }
    return {
      product,
      termInMonths,
      rate: percentage(rateText.replace(/Fixed for 36 months/u, "").trim()),
      condition,
      sourceUrl: asb,
    };
  });
}

function bnzMortgage(pages: ReadonlyMap<string, string>): Observation[] {
  const html = page(pages, bnz);
  const rows = matchingTable(html, /^Term\s*Standard/u);
  if (
    JSON.stringify(rows[0]) !==
    JSON.stringify([
      "Term",
      "Standard Fixed or floating",
      "TotalMoney Offset",
      "Rapid Repay Revolving",
      "Mortgage One Revolving",
    ])
  ) {
    throw new Error("BNZ home loan columns changed");
  }
  const data = requireCount(rows.slice(1), 8);
  const rates: Observation[] = [];
  for (const [label, standard, total, rapid, one] of data) {
    const termInMonths = termMonths(label ?? "");
    rates.push({
      product: "Standard",
      termInMonths,
      rate: percentage(standard ?? ""),
      sourceUrl: bnz,
      condition: "Minimum 20% equity; low equity premium may apply.",
    });
    if (termInMonths === null) {
      for (const [product, rate] of [
        ["TotalMoney", total],
        ["Rapid Repay", rapid],
        ["Mortgage One", one],
      ]) {
        rates.push({
          product: product ?? "",
          termInMonths,
          rate: percentage(rate ?? ""),
          sourceUrl: bnz,
          condition:
            product === "Mortgage One"
              ? "Available through Business Partners, Commercial Partners and Private Bankers only."
              : "Minimum 20% equity; low equity premium may apply.",
        });
      }
    } else if ([total, rapid, one].some((rate) => rate !== "n/a")) {
      throw new Error(
        "BNZ published an unexpected fixed-rate product; review coverage"
      );
    }
  }
  const better = requiredMatch(
    plainText(html),
    /You could borrow up to \$80,000 at a (?<rate>[\d.]+)% p\.a\. fixed rate for (?<years>\d+) years/u
  );
  rates.push({
    product: "Better Future Home Loan",
    termInMonths: Number(better[2]) * 12,
    rate: percentage(better[1] ?? ""),
    sourceUrl: bnz,
    condition:
      "Eligible home upgrades or electric transport; up to $80,000, lending criteria apply.",
  });
  return rates;
}

function westpacMortgage(pages: ReadonlyMap<string, string>): Observation[] {
  const html = page(pages, westpac);
  const fixed = requireCount(matchingTable(html, /^Rate\s*Term/u).slice(1), 14);
  const rates: Observation[] = fixed.map(([rate, label]) => {
    const special = / - special\*?$/u.test(label ?? "");
    return {
      product: special ? "Special" : "Standard",
      termInMonths: termMonths((label ?? "").replace(/ - special\*?$/u, "")),
      rate: percentage(rate ?? ""),
      sourceUrl: westpac,
      condition: special
        ? "Minimum 20% equity plus salary credit to a Westpac transaction account; business and investment lending excluded."
        : null,
    };
  });
  const floating = requireCount(
    matchingTable(html, /^Home loan option\s*Rate/u).slice(1),
    3
  );
  const products: Record<string, string> = {
    "Choices Floating (Residential Base Rate)": "Standard",
    "Choices Everyday Floating (Transactional Base Rate)": "Choices Everyday",
    "Choices Floating with Offset (Housing Base Rate)": "Choices Offset",
  };
  for (const [label, value] of floating) {
    const product = products[(label ?? "").replace(/\s*\(/u, " (")];
    if (!product) {
      throw new Error(`Unknown Westpac floating product: ${label}`);
    }
    rates.push({
      product,
      termInMonths: null,
      rate: percentage(value ?? ""),
      sourceUrl: westpac,
    });
  }
  const offer = requiredMatch(
    plainText(page(pages, greater)),
    /(?<rate>[\d.]+)% interest on up to \$50,000 for five years with a Westpac Greater Choices home loan\./u
  );
  rates.push({
    product: "Greater Choices",
    rate: percentage(offer[1] ?? ""),
    termInMonths: 60,
    sourceUrl: greater,
    condition:
      "Eligible purchases up to $50,000; existing or new Choices lending of at least $150,000 and equity criteria apply.",
  });
  return rates;
}

export const majorBankSources: DirectSource[] = [
  {
    id: "asb-mortgage",
    institution: "asb",
    dataset: "mortgage-rates",
    urls: [asb],
    browser: {
      [asb]: {
        selector: "table .enhanced-table-cell-api",
        minimumRates: 11,
        requiredResponses: ["https://api.asb.co.nz/public/v1/interest-rates"],
      },
    },
    parse: asbMortgage,
  },
  {
    id: "bnz-mortgage",
    institution: "bnz",
    dataset: "mortgage-rates",
    urls: [bnz],
    browser: {
      [bnz]: {
        selector: "#compare-rates td",
        minimumRates: 11,
        requiredResponses: ["https://api.bnz.co.nz/v1/ratesfeed/home/xml"],
      },
    },
    parse: bnzMortgage,
  },
  {
    id: "westpac-mortgage",
    institution: "westpac",
    dataset: "mortgage-rates",
    urls: [westpac, greater],
    browser: {
      [westpac]: { selector: ".charge-table__cell", minimumRates: 17 },
      [greater]: { selector: "li", minimumRates: 1 },
    },
    parse: westpacMortgage,
  },
  ...(["personal-loan-rates", "car-loan-rates"] as const).map(
    (dataset): DirectSource => ({
      id: dataset === "personal-loan-rates" ? "asb-personal" : "asb-car",
      institution: "asb",
      dataset,
      urls: [asbPersonal],
      browser: {
        [asbPersonal]: { selector: ".component-benefits li", minimumRates: 1 },
      },
      parse(pages) {
        const text = plainText(page(pages, asbPersonal));
        const match = requiredMatch(
          text,
          /Once approved, you will receive our fixed rate of (?<rate>[\d.]+)% p\.a\./u
        );
        if (
          !text.includes("Buy a new or used vehicle") ||
          !text.includes("Consolidate your debt")
        ) {
          throw new Error("ASB personal loan purposes changed");
        }
        return (
          dataset === "personal-loan-rates"
            ? ["Personal Loan", "Debt Consolidation"]
            : ["Personal Loan"]
        ).map((product) => ({
          product,
          plan: "Unsecured",
          rate: percentage(match[1] ?? ""),
          sourceUrl: asbPersonal,
        }));
      },
    })
  ),
];
