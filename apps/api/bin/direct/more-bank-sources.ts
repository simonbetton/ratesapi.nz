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

const asb = "https://www.asb.co.nz/credit-cards/interest-rates-fees.html";
const bnz =
  "https://www.bnz.co.nz/personal-banking/credit-cards/compare-credit-cards";
const bnzOld =
  "https://www.bnz.co.nz/support/rates-and-fees/products-no-longer-on-sale/credit-cards";
const bnzLoan = "https://www.bnz.co.nz/personal-banking/personal-loan";
const westpac =
  "https://www.westpac.co.nz/about-us/legal-information-privacy/cards-terms-fees-rates/";
const boc = "https://www.bankofchina.com/nz/en/bocinfo/bi3/";

function bankOfChinaPage(pages: ReadonlyMap<string, string>): string {
  const $ = load(page(pages, boc));
  const links = $("a[href]")
    .toArray()
    .filter((a) =>
      /^Residential Mortgage Interest Rates \(\d{8}\)/u.test($(a).text().trim())
    );
  if (!links.length) {
    throw new Error("Bank of China current mortgage disclosure missing");
  }
  links.sort((a, b) => $(b).text().localeCompare($(a).text()));
  return new URL($(links[0]).attr("href") ?? "", boc).href;
}

function tableValue(rows: string[][], label: RegExp, column = 1): string {
  const [row] = requireCount(
    rows.filter(([name]) => label.test(name ?? "")),
    1
  );
  if (!row?.[column]) {
    throw new Error(`Missing ${label} column ${column}`);
  }
  return row[column];
}

function cardRate(value: string): number {
  return percentage(value.replaceAll("per annum", "").trim());
}

export const moreBankSources: DirectSource[] = [
  {
    id: "asb-cards",
    institution: "asb",
    dataset: "credit-card-rates",
    urls: [asb],
    browser: {
      [asb]: {
        selector: "table .enhanced-table-cell-api",
        minimumRates: 12,
        requiredResponses: ["https://api.asb.co.nz/public/v1/interest-rates"],
      },
    },
    parse(pages) {
      const $ = load(page(pages, asb));
      return requireCount(
        $("h2")
          .toArray()
          .filter((h) => $(h).text().startsWith("ASB Visa ")),
        4
      ).map((h) => {
        const name = $(h).text().trim().replace(/^ASB /u, "");
        const section = $(h).closest(".page-rates-and-fees");
        const rows = tableRows(load(section.html() ?? ""), "table");
        const text = section.text().replaceAll(/\s+/gu, " ");
        return {
          product: name,
          rate: percentage(tableValue(rows, /^Purchase interest rate$/u)),
          cashAdvanceRate: percentage(
            tableValue(rows, /^Cash advance interest rate$/u)
          ),
          primaryFeeNZD:
            Number(
              requiredMatch(
                text,
                /Individual account fee \(every 6 months\)\s*\$(?<fee>[\d.]+)/u
              )[1]
            ) * 2,
          sourceUrl: asb,
        };
      });
    },
  },
  {
    id: "bnz-personal",
    institution: "bnz",
    dataset: "personal-loan-rates",
    urls: [bnzLoan],
    browser: { [bnzLoan]: { selector: "table td", minimumRates: 1 } },
    parse(pages) {
      const rows = matchingTable(page(pages, bnzLoan), /^Type\s*Rate\/charge/u);
      return [
        {
          product: "Advanced",
          rate: cardRate(tableValue(rows, /^Interest rate/u)),
          plan: "Unsecured",
          sourceUrl: bnzLoan,
          condition:
            "Advanced Personal Loan; standard lending criteria and fees apply.",
        },
      ];
    },
  },
  {
    id: "bnz-cards",
    institution: "bnz",
    dataset: "credit-card-rates",
    urls: [bnz, bnzOld],
    browser: { [bnz]: { selector: "table td", minimumRates: 4 } },
    parse(pages) {
      const rows = matchingTable(page(pages, bnz), /Purchase interest rate/u);
      if (
        !/BNZ Lite Visa/u.test(rows[0]?.[1] ?? "") ||
        !/BNZ Advantage Visa Platinum/u.test(rows[0]?.[2] ?? "")
      ) {
        throw new Error("BNZ credit card columns changed");
      }
      const rates: Observation[] = ["Lite Card", "Advantage Visa Platinum"].map(
        (product, i) => ({
          product,
          rate: cardRate(tableValue(rows, /^Purchase interest rate/u, i + 1)),
          cashAdvanceRate: cardRate(tableValue(rows, /^Cash advance$/u, i + 1)),
          primaryFeeNZD:
            Number(
              requiredMatch(
                tableValue(rows, /^Account fee/u, i + 1),
                /^\$(?<fee>[\d.]+)\s*half-yearly$/u
              )[1]
            ) * 2,
          interestFreePeriodInMonths: Number(
            requiredMatch(
              tableValue(rows, /^Interest free days/u, i + 1),
              /^Up to (?<days>\d+)$/u
            )[1]
          ),
          sourceUrl: bnz,
        })
      );
      const old = matchingTable(page(pages, bnzOld), /Purchase interest rate/u);
      rates.push({
        product: "Advantage Classic",
        rate: cardRate(tableValue(old, /^Purchase interest rate/u)),
        cashAdvanceRate: cardRate(tableValue(old, /^Cash advance\^?$/u)),
        primaryFeeNZD:
          Number(
            requiredMatch(
              tableValue(old, /^Account fee/u),
              /^\$(?<fee>[\d.]+)\s*half-yearly$/u
            )[1]
          ) * 2,
        sourceUrl: bnzOld,
        condition: "Existing accounts; no longer on sale.",
      });
      return rates;
    },
  },
  {
    id: "westpac-cards",
    institution: "westpac",
    dataset: "credit-card-rates",
    urls: [westpac],
    browser: {
      [westpac]: { selector: ".charge-table__cell", minimumRates: 14 },
    },
    parse(pages) {
      const $ = load(page(pages, westpac));
      const text = plainText(page(pages, westpac));
      const purchases =
        requiredMatch(
          text,
          /Purchase rates\s*Rate\s*(?<rows>.+?) Cash advance rates\s*Rate/u
        )[1] ?? "";
      const cash =
        requiredMatch(
          text,
          /Cash advance rates\s*Rate\s*(?<rows>.+?) More about cash advance rates/u
        )[1] ?? "";
      const names = [
        "Fee Free",
        "Airpoints",
        "Airpoints Platinum",
        "Airpoints World",
        "Hotpoints",
        "Platinum Hotpoints",
        "Hotpoints World",
      ];
      const fees = [
        "credit-card-fees",
        "airpointsmastercard",
        "airpoints-platinum",
        "airpoints-world",
        "hotpoints-mastercard",
        "hotpointsplatinum",
        "hotpoints-world",
      ];
      const labels = [
        "Fee Free Mastercard®",
        "Westpac Airpoints™ Mastercard®",
        "Westpac Airpoints™ Platinum Mastercard®",
        "Westpac Airpoints™ World Mastercard®",
        "hotpoints® Mastercard®",
        "hotpoints® Platinum Mastercard®",
        "hotpoints® World Mastercard®",
      ];
      requireCount([...purchases.matchAll(/[\d.]+% p\.a\./gu)], 7);
      requireCount([...cash.matchAll(/[\d.]+% p\.a\./gu)], 7);
      return names.map((product, index) => ({
        product,
        rate: percentage(
          requiredMatch(
            purchases,
            new RegExp(`${labels[index]}\\s*([\\d.]+)%`, "u")
          )[1] ?? ""
        ),
        cashAdvanceRate: percentage(
          requiredMatch(
            cash,
            new RegExp(`${labels[index]}\\s*([\\d.]+)%`, "u")
          )[1] ?? ""
        ),
        primaryFeeNZD: Number(
          requiredMatch(
            $(`#${fees[index]}`)
              .closest("section")
              .next("section")
              .text()
              .replaceAll(/\s+/gu, " "),
            /Annual account fee\s*\$(?<fee>[\d.]+)/u
          )[1]
        ),
        sourceUrl: westpac,
      }));
    },
  },
  {
    id: "bank-of-china-mortgage",
    institution: "bank-of-china",
    dataset: "mortgage-rates",
    urls: [boc],
    discover: (pages) => [bankOfChinaPage(pages)],
    parse(pages) {
      const sourceUrl = bankOfChinaPage(pages);
      const rows = matchingTable(page(pages, sourceUrl), /^Floating/u);
      const terms = requireCount(rows[0] ?? [], 9)
        .slice(1)
        .map((t) => termMonths(t.replace(/^Fixed\s*/u, "")));
      const products = [
        "Standard",
        "Special",
        "Plus Home Loan",
        "Plus Offset Home Loan",
      ];
      return requireCount(rows.slice(1), 4).flatMap((row, index) =>
        requireCount(row, 9)
          .slice(1)
          .flatMap((value, i) =>
            value === "n/a"
              ? []
              : [
                  {
                    product: products[index] ?? "",
                    rate: percentage(value),
                    termInMonths: terms[i],
                    sourceUrl,
                    condition:
                      index === 1
                        ? "Minimum 20% equity and $500,000 lending; subject to credit assessment."
                        : "Bank of China lending criteria, minimum loan amounts and fees apply.",
                  },
                ]
          )
      );
    },
  },
];
