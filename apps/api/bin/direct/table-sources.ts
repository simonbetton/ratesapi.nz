import {
  advertisedRate,
  matchingTable,
  page,
  percentage,
  plainText,
  requireCount,
  requiredMatch,
  termMonths,
} from "./parsing";
import type { DirectSource, Observation } from "./types";

const sbs = "https://www.sbsbank.co.nz/rates";
const nbs = "https://www.nbs.co.nz/interest-rates-and-fees";
const first = "https://www.firstcreditunion.co.nz/about/rates-and-fees/";
const police = "https://www.policecu.org.nz/about-us/rates/";
const unity = "https://unitymoney.co.nz/about-us/interest-rates/";
const simplicity = "https://simplicity.kiwi/simplicity-first-home-loans";

export const tableSources: DirectSource[] = [
  ...(["personal-loan-rates", "car-loan-rates"] as const).map(
    (dataset): DirectSource => {
      const url =
        "https://www.toyota.co.nz/toyota-finance-leasing/consumer-interest-rates-and-fees/";
      return {
        id: `toyota-${dataset}`,
        institution: "toyota-financial-services",
        dataset,
        urls: [url],
        parse(pages) {
          const rows = matchingTable(
            page(pages, url),
            /^Product\s+Interest rate/u
          ).slice(1);
          if (rows.length !== 5) {
            throw new Error("Toyota product table changed");
          }
          const wanted =
            dataset === "personal-loan-rates"
              ? ["Personal Loan**"]
              : [
                  "Credit Contract",
                  "Variable Rate Credit Contract*",
                  "Credit Contract Marine",
                ];
          const rates = wanted.map((label): Observation => {
            const matches = rows.filter(([name]) => name === label);
            if (matches.length !== 1) {
              throw new Error(`Missing Toyota product: ${label}`);
            }
            return {
              product: label.replaceAll("*", ""),
              ...advertisedRate(matches[0]?.[1] ?? ""),
              sourceUrl: url,
              condition:
                dataset === "personal-loan-rates"
                  ? "Only available to customers who have been with Toyota Finance for at least 12 months; rate depends on assessment."
                  : "Rate depends on assessment. Fixed for the contract term except Variable Rate Credit Contract; marine finance is identified separately.",
            };
          });
          return rates;
        },
      };
    }
  ),
  {
    id: "sbs-mortgage",
    institution: "sbs-bank",
    dataset: "mortgage-rates",
    urls: [sbs],
    parse(pages) {
      const html = page(pages, sbs);
      const rows = matchingTable(
        html,
        /Residential Floating Rate \/ First Home Loan Floating Rate/u
      );
      const rates: Observation[] = [];
      if (
        rows[0]?.[1] !== "Special Rates P.A.*" ||
        rows[0]?.[2] !== "Standard Rates P.A."
      ) {
        throw new Error("SBS special and standard rate columns changed");
      }
      for (const [label, special, standard] of rows.slice(1)) {
        if (!label || /Default/iu.test(label)) {
          continue;
        }
        if (/Residential.*Floating Rate/u.test(label)) {
          rates.push({
            product: label.includes("Investing")
              ? "Residential Investing"
              : "Residential",
            termInMonths: null,
            rate: percentage(standard ?? ""),
            sourceUrl: sbs,
            condition:
              "Published rate for new lending; existing floating loans can have a later effective date. Check the source for details.",
          });
        } else {
          const termInMonths = termMonths(label);
          rates.push(
            {
              product: "Residential",
              termInMonths,
              rate: percentage(standard ?? ""),
              sourceUrl: sbs,
            },
            {
              product: "Special",
              termInMonths,
              rate: percentage(special ?? ""),
              sourceUrl: sbs,
              condition:
                "Minimum 20% equity and SBS eligibility criteria apply.",
            }
          );
        }
      }
      rates.push(...sbsOtherRates(html));
      return requireCount(rates, 20);
    },
  },
  {
    id: "nbs-mortgage",
    institution: "nelson-bldg-society",
    dataset: "mortgage-rates",
    urls: [nbs],
    parse(pages) {
      const html = page(pages, nbs);
      const rates: Observation[] = [];
      for (const [pattern, product] of [
        [/^NBS Home Loan rates\s*6 months/u, "Residential"],
        [/^NBS Home Loan rates for low equity/u, "Low equity"],
      ] as const) {
        for (const [label, value] of matchingTable(html, pattern).slice(1)) {
          if (value === undefined) {
            // The full-width terms disclosure is not a rate row.
            continue;
          }
          const flexi = label?.startsWith("NBS Flexi Loan");
          rates.push({
            product: flexi ? "Flexi Loan" : product,
            termInMonths: flexi ? null : termMonths(label ?? ""),
            rate: percentage(value),
            sourceUrl: nbs,
            condition:
              product === "Low equity"
                ? "Less than 20% equity. Published rates for new lending; existing floating facilities may have a different effective date."
                : "Minimum 20% equity. Published rates for new lending; existing floating facilities may have a different effective date.",
          });
        }
      }
      return requireCount(rates, 9);
    },
  },
  {
    id: "nbs-personal",
    institution: "nelson-bldg-society",
    dataset: "personal-loan-rates",
    urls: [nbs],
    parse(pages) {
      const rows = matchingTable(page(pages, nbs), /^NBS Personal Loan rates/u);
      const row = rows.find(([label]) => label === "Interest rate range");
      return [
        {
          product: "Personal Loan",
          ...advertisedRate(row?.[1] ?? ""),
          sourceUrl: nbs,
          condition: "Rates for new facilities; lending criteria apply.",
        },
      ];
    },
  },
  {
    id: "firstcu-mortgage",
    institution: "first-cu",
    dataset: "mortgage-rates",
    urls: [first],
    parse(pages) {
      const html = page(pages, first);
      const matrix = matchingTable(html, /Special \(Less than 80% LVR\)/u);
      const [header] = matrix;
      if (header?.[1] !== "1 Year Fixed" || header[2] !== "2 Year Fixed") {
        throw new Error("First Credit Union fixed term columns changed");
      }
      const rates: Observation[] = [];
      for (const [label, one, two] of matrix.slice(1)) {
        if (!label || !/^(?<value>Special|Standard) \(/u.test(label)) {
          throw new Error("Unknown First Credit Union product");
        }
        const product = label.startsWith("Special") ? "Special" : "Standard";
        rates.push(
          {
            product,
            termInMonths: 12,
            rate: percentage(one ?? ""),
            sourceUrl: first,
            condition: label,
          },
          {
            product,
            termInMonths: 24,
            rate: percentage(two ?? ""),
            sourceUrl: first,
            condition: label,
          }
        );
      }
      const [floating] = matchingTable(html, /^Floating\s/u);
      rates.push({
        product: "Standard",
        termInMonths: null,
        rate: percentage(floating?.[1] ?? ""),
        sourceUrl: first,
      });
      return requireCount(rates, 5);
    },
  },
  {
    id: "police-mortgage",
    institution: "police-cu",
    dataset: "mortgage-rates",
    urls: [police],
    parse(pages) {
      const rows = matchingTable(page(pages, police), /First Home TOGETHER/u);
      let product = "";
      const rates: Observation[] = [];
      for (const [label, term, value] of rows.slice(1)) {
        if (label === "All home loans") {
          continue;
        }
        if (label) {
          const names: Record<string, string> = {
            "Standard*": "Standard",
            Standard: "Standard",
            "First Home TOGETHER": "Shared Ownership",
            "Retire Easy": "Reverse Mortgage",
          };
          product = names[label] ?? "";
        }
        if (!product) {
          throw new Error("Unknown Police Credit Union mortgage product");
        }
        rates.push({
          product,
          termInMonths: termMonths(term ?? ""),
          rate: percentage(value ?? ""),
          sourceUrl: police,
          condition:
            "Police Credit Union membership and product eligibility criteria apply.",
        });
      }
      return requireCount(rates, 11);
    },
  },
  ...(["personal-loan-rates", "car-loan-rates"] as const).map(
    (dataset): DirectSource => ({
      id: `police-${dataset}`,
      institution: "police-cu",
      dataset,
      urls: [police],
      parse(pages) {
        const rows = matchingTable(
          page(pages, police),
          /Lending type\s*Security\s*Rate/u
        );
        const rates: Observation[] = [];
        let lendingType = "";
        for (const [label, security, value] of rows.slice(1)) {
          if (label) {
            lendingType = label;
          }
          if (
            lendingType !== "Personal Loan" ||
            (dataset === "car-loan-rates" &&
              !security?.includes("motor vehicle"))
          ) {
            continue;
          }
          rates.push({
            product: "Personal Loan",
            ...advertisedRate(value ?? ""),
            plan: security?.startsWith("Unsecured") ? "Unsecured" : "Secured",
            condition: `${security}; membership criteria apply.`,
            sourceUrl: police,
          });
        }
        return requireCount(rates, dataset === "car-loan-rates" ? 1 : 4);
      },
    })
  ),
  {
    id: "unity-mortgage",
    institution: "unitymoney",
    dataset: "mortgage-rates",
    urls: [unity],
    parse(pages) {
      const rows = matchingTable(
        page(pages, unity),
        /Under 80% LVR\s*Over 80% LVR/u
      );
      const rates: Observation[] = [];
      for (const [label, special, standard] of rows.slice(2)) {
        if (label === "Fixed") {
          continue;
        }
        const fhb = label?.includes("First Home Buyer");
        const termInMonths = termMonths(fhb ? "12 months" : (label ?? ""));
        rates.push({
          product: fhb ? "First Home Buyer Special" : "Special",
          termInMonths,
          rate: percentage(special ?? ""),
          sourceUrl: unity,
          condition: fhb
            ? "First home buyer eligibility criteria apply."
            : "Under 80% LVR.",
        });
        if (!fhb) {
          rates.push({
            product: "Standard",
            termInMonths,
            rate: percentage(standard ?? ""),
            sourceUrl: unity,
            condition: "Over 80% LVR.",
          });
        }
      }
      return requireCount(rates, 11);
    },
  },
  ...(["personal-loan-rates", "car-loan-rates"] as const).map(
    (dataset): DirectSource => ({
      id: `unity-${dataset}`,
      institution: "unitymoney",
      dataset,
      urls: [unity],
      parse(pages) {
        const rows = matchingTable(
          page(pages, unity),
          /Loan Type\s*Interest rate\s*Loan amounts/u
        );
        return requireCount(
          rows.slice(1).map(([plan, value, amount]) => ({
            product: "Personal Loan",
            plan: plan ?? null,
            condition: `${amount}; lending and credit criteria apply.`,
            ...advertisedRate(value ?? ""),
            sourceUrl: unity,
          })),
          2
        );
      },
    })
  ),
  {
    id: "simplicity-mortgage",
    institution: "simplicity",
    dataset: "mortgage-rates",
    urls: [simplicity],
    parse(pages) {
      const text = plainText(page(pages, simplicity));
      const match = requiredMatch(
        text,
        /Simplicity floating rate (?<value>[\d.]+)%/u
      );
      return [
        {
          product: "Member home loan",
          termInMonths: null,
          rate: percentage(match[1] ?? ""),
          sourceUrl: simplicity,
          condition:
            "Simplicity membership and home loan eligibility criteria apply.",
        },
      ];
    },
  },
];

function sbsOtherRates(html: string): Observation[] {
  const rates: Observation[] = [];
  const combo = matchingTable(html, /Residential Floating Rate discount/u);
  for (const [label, value] of combo.slice(1)) {
    const construction = label?.startsWith("Residential Floating") ?? false;
    rates.push({
      product: construction
        ? "Construction lending for FHB"
        : "First Home Combo",
      termInMonths: construction ? null : termMonths(label ?? ""),
      rate: percentage(value ?? ""),
      sourceUrl: sbs,
      condition: construction
        ? "Construction lending for first home buyers only; First Home Combo eligibility criteria apply."
        : "First Home Combo eligibility criteria apply.",
    });
  }
  const other = matchingTable(html, /SBS Unwind Floating Interest Rate/u);
  for (const [label, value] of other.slice(1)) {
    if (label?.startsWith("Default")) {
      continue;
    }
    rates.push({
      product: label?.includes("Unwind") ? "Unwind reverse equity" : "Advance",
      termInMonths: null,
      rate: percentage(value ?? ""),
      sourceUrl: sbs,
    });
  }
  return rates;
}
