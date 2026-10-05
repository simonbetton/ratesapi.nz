import { load } from "cheerio";

import {
  matchingTable,
  page,
  percentage,
  plainText,
  requireCount,
  requiredMatch,
  tableRows,
  termMonths,
} from "./parsing";
import type { DirectSource, Observation } from "./types";

const indi = "https://indi.nz/";
const pepper = "https://adviser.peppermoney.co.nz/home-loans";
const aia = "https://www.asb.co.nz/lending/aia-interest-rates-fees.html";
const lending = "https://lendingcrowd.co.nz/howitworks/ratesandfees";
const financeDirect = "https://www.financedirect.co.nz/";
const fhl = "https://www.fhlnz.co.nz/interestRates/";
const fhlHome = "https://www.fhlnz.co.nz/";
const qcard = "https://www.qcard.co.nz/fees-and-charges/";

export const remainingSources: DirectSource[] = [
  {
    id: "indi-mortgage",
    institution: "indi",
    dataset: "mortgage-rates",
    urls: [indi],
    parse(pages) {
      const $ = load(page(pages, indi));
      $("script, style, nav, footer").remove();
      const match = requiredMatch(
        $("body").text().replaceAll(/\s+/gu, " "),
        /your indi floating rate\s*(?<rate>[\d.]+)\s*%/iu
      );
      return [
        {
          product: "Standard",
          rate: percentage(match[1] ?? ""),
          termInMonths: null,
          sourceUrl: indi,
          condition:
            "Floating table loan; minimum 20% equity. Early-access eligibility and lending criteria apply.",
        },
      ];
    },
  },
  {
    id: "pepper-mortgage",
    institution: "pepper-money",
    dataset: "mortgage-rates",
    urls: [pepper],
    parse(pages) {
      const text = plainText(page(pages, pepper));
      return ["Prime", "Near Prime", "Specialist"].map((product) => {
        const match = requiredMatch(
          text,
          new RegExp(
            `Pepper ${product} home loan floating interest rates range from ([\\d.]+) – ([\\d.]+)%`,
            "u"
          )
        );
        return {
          product,
          rate: percentage(match[1] ?? ""),
          rateMaximum: percentage(match[2] ?? ""),
          rateType: "range",
          termInMonths: null,
          sourceUrl: pepper,
          condition:
            "Floating rate range; actual rate depends on credit history, LVR, full/alternative documentation and loan product. Fees apply.",
        };
      });
    },
  },
  {
    id: "aia-mortgage",
    institution: "aia",
    dataset: "mortgage-rates",
    urls: [aia],
    browser: {
      [aia]: {
        selector: "table .enhanced-table-cell-api",
        minimumRates: 10,
        requiredResponses: ["https://api.asb.co.nz/public/v1/interest-rates"],
      },
    },
    parse(pages) {
      return requireCount(
        matchingTable(page(pages, aia), /^Term Interest Rate/u).slice(1),
        10
      ).map(([label, value]) => {
        const betterHomes = label?.startsWith("ASB Better");
        let product = "Standard Go";
        if (betterHomes) {
          product = "Better Homes Top Up";
        } else if (label?.startsWith("Back My")) {
          product = "Back My Build";
        }
        let termInMonths: number | null = null;
        if (betterHomes) {
          termInMonths = 36;
        } else if (!/Floating/u.test(label ?? "")) {
          termInMonths = termMonths(label ?? "");
        }
        return {
          product,
          rate: percentage(
            (value ?? "")
              .split("Effective on and from")[0]
              ?.replace(/Fixed for 36 months/u, "")
              .trim() ?? ""
          ),
          termInMonths,
          sourceUrl: aia,
          condition:
            "GO Home Loans serviced by ASB; closed to new applications. Minimum 20% equity for these rates; product eligibility conditions apply.",
        };
      });
    },
  },
  {
    id: "lending-crowd-personal",
    institution: "lending-crowd",
    dataset: "personal-loan-rates",
    urls: [lending],
    browser: { [lending]: { selector: "table td", minimumRates: 45 } },
    parse(pages) {
      const $ = load(page(pages, lending));
      const tables = requireCount(
        $("table")
          .toArray()
          .filter(
            (t) =>
              /A1-[US]/u.test($(t).text()) &&
              $(t).parent().prevAll("h6").first().text().trim() === "Personal"
          ),
        2
      );
      const rates: Observation[] = [];
      for (const table of tables) {
        const heading = $(table).parent().prevAll("h5").first().text().trim();
        if (!["Unsecured loans", "Secured loans"].includes(heading)) {
          throw new Error("Lending Crowd security heading changed");
        }
        const unsecured = heading === "Unsecured loans";
        const rows = tableRows(load($.html(table)), "table");
        const grades = requireCount(rows[0] ?? [], 10).slice(1);
        const expectedGrades = [
          "A1",
          "A2",
          "A3",
          "B1",
          "B2",
          "B3",
          "C1",
          "C2",
          "C3",
        ].map((grade) => `${grade}-${unsecured ? "U" : "S"}`);
        if (grades.join("|") !== expectedGrades.join("|")) {
          throw new Error("Lending Crowd credit grades changed");
        }
        for (const row of requireCount(rows.slice(1), unsecured ? 3 : 2)) {
          requireCount(row, 10);
          if (!/^(?:2|3|5) Years$/u.test(row[0] ?? "")) {
            throw new Error("Lending Crowd term changed");
          }
          for (const [col, grade] of grades.entries()) {
            rates.push({
              product: `Credit grade - ${grade} (${row[0]})`,
              plan: unsecured ? "Unsecured" : "Secured",
              rate: percentage(row[col + 1] ?? ""),
              sourceUrl: lending,
              condition:
                "Personal borrowing rate for the specified loan grade, security and term; subject to platform assessment and fees.",
            });
          }
        }
      }
      return rates;
    },
  },
  ...(["personal-loan-rates", "car-loan-rates"] as const).map(
    (dataset): DirectSource => ({
      id: `finance-direct-${dataset}`,
      institution: "finance-direct",
      dataset,
      urls: [financeDirect],
      parse(pages) {
        const purpose = dataset === "car-loan-rates" ? "Auto" : "Personal";
        const match = requiredMatch(
          plainText(page(pages, financeDirect)),
          new RegExp(`${purpose} Finance from ([\\d.]+)%`, "u")
        );
        return [
          {
            product:
              dataset === "car-loan-rates" ? "Car Loans" : "Personal Loan",
            rate: percentage(match[1] ?? ""),
            rateType: "from",
            sourceUrl: financeDirect,
            condition:
              "Advertised starting rate; actual rate, security and fees depend on individual assessment.",
          },
        ];
      },
    })
  ),
  {
    id: "fhl-personal",
    institution: "financial-holdings",
    dataset: "personal-loan-rates",
    urls: [fhl],
    parse(pages) {
      const text = plainText(page(pages, fhl));
      return ["Secured", "Unsecured"].flatMap((plan) => {
        const match = requiredMatch(
          text,
          new RegExp(
            `${plan} personal loan rates Risk Grade Tier 1 Tier 2 Tier 3 Interest rate p.a. ([\\d.]+)% ([\\d.]+)% ([\\d.]+)%`,
            "u"
          )
        );
        return [1, 2, 3].map((tier) => ({
          product: `Personal Loan — Tier ${tier}`,
          plan,
          rate: percentage(match[tier] ?? ""),
          rateType: "from",
          sourceUrl: fhl,
          condition:
            "Indicative rate band starting rate; risk grade assigned after credit and affordability assessment. Fees apply.",
        }));
      });
    },
  },
  {
    id: "fhl-car",
    institution: "financial-holdings",
    dataset: "car-loan-rates",
    urls: [fhlHome],
    parse(pages) {
      const match = requiredMatch(
        plainText(page(pages, fhlHome)),
        /Vehicle Finance Finance your vehicle with us today.+?Interest rates from (?<rate>[\d.]+)%/u
      );
      return [
        {
          product: "Vehicle Loan",
          rate: percentage(match[1] ?? ""),
          rateType: "from",
          sourceUrl: fhlHome,
          plan: "Secured",
          condition:
            "Vehicle finance advertised starting rate; subject to credit assessment and fees.",
        },
      ];
    },
  },
  {
    id: "humm-cards",
    institution: "humm-group",
    dataset: "credit-card-rates",
    urls: [qcard],
    browser: { [qcard]: { selector: "p", minimumRates: 3 } },
    parse(pages) {
      const text = plainText(page(pages, qcard));
      return ["Q Mastercard", "Q Card"].map((product) => {
        const section =
          requiredMatch(
            text,
            new RegExp(
              `${product} (?:Annual interest rates|Interest rates) (.+?)${product} Default`,
              "u"
            )
          )[1] ?? "";
        const cash = /Cash Advance Interest Rate (?<rate>[\d.]+)%/u.exec(
          section
        );
        return {
          product,
          rate: percentage(
            requiredMatch(
              section,
              /Standard Interest Rate (?:Our Standard Interest Rate is )?(?<rate>[\d.]+)%/u
            )[1] ?? ""
          ),
          primaryFeeNZD: Number(
            requiredMatch(
              section,
              /Account Fee An annual fee of \$(?<fee>[\d.]+)/u
            )[1]
          ),
          ...(cash ? { cashAdvanceRate: percentage(cash[1] ?? "") } : {}),
          sourceUrl: qcard,
          condition:
            "Standard rate after any applicable interest-free promotional period.",
        };
      });
    },
  },
];
