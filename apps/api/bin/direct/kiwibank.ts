import { load } from "cheerio";

import {
  page,
  percentage,
  requireCount,
  tableRows,
  termMonths,
} from "./parsing";
import type { DirectSource, Observation } from "./types";

const home =
  "https://www.kiwibank.co.nz/personal-banking/home-loans/rates-and-fees/";
const cards =
  "https://www.kiwibank.co.nz/personal-banking/credit-cards/rates-and-fees/";
const feed =
  "https://rates.kiwibank.co.nz/api/v1/rates?id__in=562,676,563,677,565,679,567,681,568,682,569,683,571,572,663,733,582,649";

interface KiwiRate {
  id: number;
  rate: string;
  enabled: boolean;
  is_valid: boolean;
  terms: { term: string } | null;
}

function hydrate(
  pages: ReadonlyMap<string, string>,
  url: string
): string[][][] {
  const json: { results?: KiwiRate[]; next?: string | null } = JSON.parse(
    page(pages, feed)
  );
  if (!Array.isArray(json.results) || json.next) {
    throw new Error("Kiwibank returned an incomplete rate feed");
  }
  const $ = load(page(pages, url));
  for (const node of $("[data-rate]").toArray()) {
    const code = Number($(node).attr("data-rate"));
    const matches = json.results.filter((rate) => rate.id === code);
    const [rate] = matches;
    if (matches.length !== 1 || !rate?.enabled || !rate.is_valid) {
      throw new Error(
        `Kiwibank rate ${code} is missing, duplicated or disabled`
      );
    }
    const display = $(node).attr("data-display");
    if (display === "terms" || display === "terms-only") {
      if (!rate.terms?.term || rate.terms.term.includes("{rate-")) {
        throw new Error(`Kiwibank rate ${code} has unresolved terms`);
      }
      $(node).text(rate.terms.term);
    } else if (display === undefined || display === "rate") {
      $(node).text(`${percentage(rate.rate)}%`);
    } else {
      throw new Error(`Unsupported Kiwibank rate display: ${display}`);
    }
  }
  // The page duplicates tables for responsive layouts; deduplicate identical data, not arbitrary rates.
  const tables = $("table")
    .toArray()
    .map((node) => tableRows(load($.html(node)), "table"));
  return [
    ...new Map(tables.map((rows) => [JSON.stringify(rows), rows])).values(),
  ];
}

export const kiwibankSources: DirectSource[] = [
  {
    id: "kiwibank-mortgage",
    institution: "kiwibank",
    dataset: "mortgage-rates",
    urls: [home, feed],
    parse(pages) {
      const tables = hydrate(pages, home);
      const fixed = tables.filter((rows) =>
        rows[0]?.[1]?.startsWith("Special fixed rate")
      );
      const floating = tables.filter(
        (rows) => rows[0]?.[0] === "Floating rate type"
      );
      if (fixed.length !== 1 || floating.length !== 1) {
        throw new Error("Kiwibank mortgage tables changed");
      }
      const rates: Observation[] = [];
      for (const [label, special, standard] of fixed[0]?.slice(1) ?? []) {
        const termInMonths = termMonths(label ?? "");
        rates.push(
          {
            product: "Special",
            termInMonths,
            rate: percentage(special ?? ""),
            sourceUrl: home,
            condition: "At least 20% equity.",
          },
          {
            product: "Standard",
            termInMonths,
            rate: percentage(standard ?? ""),
            sourceUrl: home,
            condition: "Less than 20% equity.",
          }
        );
      }
      const names: Record<string, string> = {
        Variable: "Standard",
        "Offset variable": "Offset Mortgage",
        Revolving: "Revolving",
      };
      for (const [label, rate] of floating[0]?.slice(1) ?? []) {
        const product = names[label ?? ""];
        if (!product) {
          throw new Error(`Unknown Kiwibank floating product: ${label}`);
        }
        rates.push({
          product,
          termInMonths: null,
          rate: percentage(rate ?? ""),
          sourceUrl: home,
        });
      }
      return requireCount(rates, 15);
    },
  },
  {
    id: "kiwibank-cards",
    institution: "kiwibank",
    dataset: "credit-card-rates",
    urls: [cards, feed],
    parse(pages) {
      const tables = hydrate(pages, cards).filter(
        (rows) =>
          rows[0]?.[1] === "Zero Visa" && rows[0]?.[2] === "Platinum Visa"
      );
      if (tables.length !== 1) {
        throw new Error("Kiwibank card comparison table changed");
      }
      const rows = tables[0] ?? [];
      function cell(label: string, column: number): string {
        const matches = rows.filter((row) => row[0] === label);
        const value = matches[0]?.[column];
        if (matches.length !== 1 || !value) {
          throw new Error(`Missing Kiwibank card field: ${label}`);
        }
        return value;
      }
      return ["Zero", "Platinum"].map((product, index) => {
        const column = index + 1;
        const fee = cell("Account fee (every six months)", column);
        const days = cell("Interest-free days", column);
        const transfer = cell(
          "Balance transferred from a non-Kiwibank credit card",
          column
        );
        const transferMatch =
          /^(?<value>\d+(?:\.\d+)?)% for (?<maximum>\d+ months)$/u.exec(
            transfer
          );
        if (
          !/^\$\d+(?:\.\d+)?$/u.test(fee) ||
          !/^Up to \d+$/u.test(days) ||
          !transferMatch
        ) {
          throw new Error(`Kiwibank card fee or period changed for ${product}`);
        }
        const rate = percentage(
          cell("Interest rate on purchases and cash advances", column)
        );
        return {
          product,
          rate,
          cashAdvanceRate: rate,
          sourceUrl: cards,
          primaryFeeNZD: Number(fee.slice(1)) * 2,
          interestFreePeriodInMonths: Number(days.replace("Up to ", "")),
          balanceTransferRate: percentage(transferMatch[1] ?? ""),
          balanceTransferPeriod: transferMatch[2] ?? null,
        };
      });
    },
  },
];
