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

const home = "https://www.tsb.co.nz/rates-fees-agreements/home-loan";
const personal = "https://www.tsb.co.nz/rates-fees-agreements/personal-loans";
const overdraft = "https://www.tsb.co.nz/rates-fees-agreements/overdraft";
const cards = "https://www.tsb.co.nz/rates-fees-agreements/credit-mastercard";
const specialLabel = "Special Rate(Minimum 20% deposit)";
const standardLabel = "Standard Rate(Less than 20% deposit)";

function tableValue(rows: string[][], label: string): string {
  const [row] = requireCount(
    rows.slice(1).filter((cells) => cells[1] === label),
    1
  );
  if (
    !row ||
    row.length !== 4 ||
    row[0] !== rows[0]?.[0] ||
    row[2] !== rows[0]?.[1] ||
    !row[3]
  ) {
    throw new Error("TSB table labels changed");
  }
  return row[3];
}

export const tsbSources: DirectSource[] = [
  {
    id: "tsb-cards",
    institution: "tsb-bank",
    dataset: "credit-card-rates",
    urls: [cards],
    browser: { [cards]: { selector: "table td", minimumRates: 4 } },
    parse(pages) {
      const html = page(pages, cards);
      return ["Low Rate", "Platinum"].map((product) => {
        const rates = requireCount(
          matchingTable(
            html,
            new RegExp(
              `^${product} Mastercard Type of interest rate Rate `,
              "u"
            )
          ),
          3
        );
        const fees = matchingTable(
          html,
          new RegExp(`^${product} Mastercard Fee Amount `, "u")
        );
        return {
          product,
          rate: percentage(tableValue(rates, "Purchase interest rate")),
          cashAdvanceRate: percentage(
            tableValue(rates, "Cash advance interest rate")
          ),
          primaryFeeNZD: Number(
            requiredMatch(
              tableValue(fees, `Annual fee – ${product} Mastercard`),
              /^\$(?<fee>\d+(?:\.\d+)?) per year$/u
            )[1]
          ),
          sourceUrl: cards,
        };
      });
    },
  },
  {
    id: "tsb-personal",
    institution: "tsb-bank",
    dataset: "personal-loan-rates",
    urls: [personal, overdraft],
    browser: {
      [personal]: { selector: "table td", minimumRates: 2 },
      [overdraft]: { selector: "table td", minimumRates: 3 },
    },
    parse(pages) {
      const personalText = plainText(page(pages, personal));
      if (
        !personalText.includes(
          "not currently accepting applications for new personal loans"
        )
      ) {
        throw new Error(
          "TSB personal loan availability changed; review conditions"
        );
      }
      return [
        {
          product: "Personal loan",
          rate: percentage(
            requiredMatch(
              personalText,
              /Type of rate Fixed interest rate Rate (?<rate>[\d.]+)% p\.a/u
            )[1] ?? ""
          ),
          condition:
            "Existing customers only; TSB is not accepting applications for new personal loans. Fixed interest rate.",
          sourceUrl: personal,
        },
        {
          product: "Overdraft facilities",
          rate: percentage(
            requiredMatch(
              plainText(page(pages, overdraft)),
              /Interest Overdraft interest rate Variable rate (?<rate>[\d.]+)% p\.a/u
            )[1] ?? ""
          ),
          condition:
            "Variable overdraft interest rate; default interest is excluded.",
          sourceUrl: overdraft,
        },
      ];
    },
  },
  {
    id: "tsb-mortgage",
    institution: "tsb-bank",
    dataset: "mortgage-rates",
    urls: [home],
    browser: { [home]: { selector: "table td", minimumRates: 17 } },
    parse(pages) {
      const rows = matchingTable(page(pages, home), /^Term Special Rate/u);
      if (
        JSON.stringify(rows[0]) !==
        JSON.stringify([
          "Term",
          "Special Rate (Minimum 20% deposit)",
          "Standard Rate (Less than 20% deposit)",
        ])
      ) {
        throw new Error("TSB mortgage columns changed");
      }
      const rates: Observation[] = [];
      for (const row of requireCount(rows.slice(1), 9)) {
        const [termLabel, term, special, specialRate, standard, standardRate] =
          row;
        if (
          row.length !== 6 ||
          termLabel !== "Term" ||
          special !== specialLabel ||
          standard !== standardLabel
        ) {
          throw new Error("TSB mortgage row labels changed");
        }
        if (term === "Revolving credit") {
          if (standardRate !== "-") {
            throw new Error(
              "TSB added a revolving standard rate; review coverage"
            );
          }
          rates.push({
            product: "Revolving Credit",
            termInMonths: null,
            rate: percentage(specialRate ?? ""),
            condition: "Minimum 20% deposit; revolving credit.",
            sourceUrl: home,
          });
          continue;
        }
        const termInMonths = termMonths(term ?? "");
        rates.push(
          {
            product: "Special",
            termInMonths,
            rate: percentage(specialRate ?? ""),
            condition: "Minimum 20% deposit.",
            sourceUrl: home,
          },
          {
            product: "Standard",
            termInMonths,
            rate: percentage(standardRate ?? ""),
            condition:
              "Less than 20% deposit; subject to availability of funds.",
            sourceUrl: home,
          }
        );
      }
      return requireCount(rates, 17);
    },
  },
];
