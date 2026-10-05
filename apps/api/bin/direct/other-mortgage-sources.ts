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

const baroda =
  "https://www.barodanzltd.co.nz/rates-and-charges/rate-of-interest-on-loans";
const ccb = "https://nz.ccb.com/lng/newzealand/en/service/262586.shtml";
const icbc =
  "https://nz.icbc.com.cn/ICBC/%E6%B5%B7%E5%A4%96%E5%88%86%E8%A1%8C/%E5%B7%A5%E9%93%B6%E6%96%B0%E8%A5%BF%E5%85%B0%E7%BD%91%E7%AB%99/EN/RatesFees/HomeLoans/HomeLoan.htm";
const resimac = "https://www.resimac.co.nz/home-loans/rates-all";

export const otherMortgageSources: DirectSource[] = [
  {
    id: "baroda-mortgage",
    institution: "bank-of-baroda",
    dataset: "mortgage-rates",
    urls: [baroda],
    browser: { [baroda]: { selector: "table td", minimumRates: 1 } },
    parse(pages) {
      const text = plainText(page(pages, baroda));
      const section =
        requiredMatch(
          text,
          /Home Loan Standard rate (?<section>.+?) Loan for professionals/u
        )[1] ?? "";
      const floating = requiredMatch(
        section,
        /subject to change:\s*(?<rate>[\d.]+)% p\.a\. Floating/u
      );
      const matches = requireCount(
        [
          ...section.matchAll(
            /(?<rate>[\d.]+)%\s*p\.a\. Fixed for (?<term>6 Months|one year|18 Months|two year|three year)/gu
          ),
        ],
        5
      );
      return [
        {
          product: "Standard",
          rate: percentage(floating[1] ?? ""),
          termInMonths: null,
          sourceUrl: baroda,
        },
        ...matches.map((m) => ({
          product: "Standard",
          rate: percentage(m[1] ?? ""),
          termInMonths: termMonths(
            (m[2] ?? "")
              .replace("one", "1")
              .replace("two", "2")
              .replace("three", "3")
          ),
          sourceUrl: baroda,
        })),
      ];
    },
  },
  {
    id: "ccb-mortgage",
    institution: "china-construction-bank",
    dataset: "mortgage-rates",
    urls: [ccb],
    browser: { [ccb]: { selector: "table td", minimumRates: 16 } },
    parse(pages) {
      const rows = matchingTable(
        page(pages, ccb),
        /^Term Special Rate\* Standard Rate/u
      );
      const data = requireCount(
        rows.slice(1).filter((r) => r.length === 3),
        8
      );
      return data.flatMap(([term, special, standard]) => [
        {
          product: "Special",
          rate: percentage(special ?? ""),
          termInMonths: termMonths(term ?? ""),
          sourceUrl: ccb,
          condition:
            "Minimum 20% equity and NZ local income; lender criteria and fees apply.",
        },
        {
          product: "Standard",
          rate: percentage(standard ?? ""),
          termInMonths: termMonths(term ?? ""),
          sourceUrl: ccb,
        },
      ]);
    },
  },
  {
    id: "icbc-mortgage",
    institution: "icbc",
    dataset: "mortgage-rates",
    urls: [icbc],
    browser: {
      [icbc]: { selector: "table.ke-zeroborder td", minimumRates: 8 },
    },
    parse(pages) {
      const $ = load(page(pages, icbc));
      const rows = tableRows($, "table.ke-zeroborder");
      const header = rows.findIndex(
        (r) => r[0] === "Term" && r[1] === "Standard Rate"
      );
      if (header === -1) {
        throw new Error("ICBC standard rate header changed");
      }
      return requireCount(rows.slice(header + 1), 8).map(([term, value]) => ({
        product: "Standard",
        rate: percentage(value ?? ""),
        termInMonths: termMonths(term ?? ""),
        sourceUrl: icbc,
        condition:
          "Standard rate; additional risk premiums may apply following credit assessment.",
      }));
    },
  },
  {
    id: "resimac-mortgage",
    institution: "resimac",
    dataset: "mortgage-rates",
    urls: [resimac],
    browser: {
      [resimac]: {
        selector: ".resimac-library--table_row_item",
        minimumRates: 66,
      },
    },
    parse(pages) {
      const $ = load(page(pages, resimac));
      const tables = requireCount(
        $(".resimac-library--table_layout").toArray(),
        5
      );
      const headings = tables.map((table) =>
        $(table)
          .closest(".resimac-library--g_content_slot")
          .find("h2")
          .text()
          .trim()
      );
      const expectedHeadings = [
        "Standard Prime Full Doc Rates.",
        "Standard Prime Alt Doc Rates.",
        "Specialist Full Doc and Specialist Alt Doc Rates.",
        "Specialist Full Doc and Specialist Alt Doc Rates.",
        "Specialist Investment Rates.",
      ];
      if (headings.join("|") !== expectedHeadings.join("|")) {
        throw new Error("Resimac table order or headings changed");
      }
      const rows = $(".resimac-library--table_row_layout")
        .toArray()
        .map((r) =>
          $(r)
            .children()
            .toArray()
            .map((c) => $(c).text().replaceAll(/\s+/gu, " ").trim())
        );
      const fixedHeaders = rows.filter(
        (row) => row.length === 7 && row[2]?.toLowerCase() === "1 year"
      );
      requireCount(fixedHeaders, 3);
      for (const header of fixedHeaders) {
        if (
          header
            .slice(2)
            .map((cell) => cell.toLowerCase())
            .join("|") !== "1 year|2 year|3 year|4 year|5 year"
        ) {
          throw new Error("Resimac fixed term columns changed");
        }
      }
      const specialistHeaders = rows.filter((row) =>
        row[0]?.startsWith("Specialist")
      );
      if (
        specialistHeaders.map((row) => row.join("|")).join(";") !==
        "Specialist Full Doc|Clear|Plus|Assist;Specialist Alt Doc|Clear|Plus|Assist"
      ) {
        throw new Error("Resimac specialist columns changed");
      }
      const regular = requireCount(
        rows.filter((r) => r.length === 7 && /% p\.a\./u.test(r[1] ?? "")),
        4
      );
      if (
        regular.map((row) => row[0]).join("|") !==
        "≤ 80% LVR|80.01-90% LVR (OO only)|≤ 80%|≤ 65% LVR*"
      ) {
        throw new Error("Resimac LVR rows changed");
      }
      const labels = [
        "Prime Full Doc ≤80% LVR",
        "Prime Full Doc 80.01–90% LVR",
        "Prime Alt Doc ≤80% LVR",
        "Specialist Investment ≤65% LVR",
      ];
      const rates: Observation[] = regular.flatMap((row, index) =>
        [null, 12, 24, 36, 48, 60].map((termInMonths, col) => ({
          product: labels[index] ?? "",
          rate: percentage(row[col + 1] ?? ""),
          termInMonths,
          sourceUrl: resimac,
          condition: [
            "Owner occupied or investment; new eligible loans, subject to credit assessment and fees.",
            "Owner occupied only; subject to credit assessment and fees.",
            "Owner occupied or investment; new eligible loans, subject to credit assessment and fees.",
            "Non-CCCFA investment lending; up to 70% LVR for eligible properties, establishment fee applies.",
          ][index],
        }))
      );
      const specialist = requireCount(
        rows.filter((r) => r.length === 4 && /% p\.a\./u.test(r[1] ?? "")),
        14
      );
      for (const [index, row] of specialist.entries()) {
        for (const [col, tier] of ["Clear", "Plus", "Assist"].entries()) {
          rates.push({
            product: `Specialist ${index < 7 ? "Full" : "Alt"} Doc ${tier} ${row[0]}`,
            rate: percentage(row[col + 1] ?? ""),
            termInMonths: null,
            sourceUrl: resimac,
            condition:
              "New eligible loans; borrower category, security, LVR and credit assessment apply.",
          });
        }
      }
      const text = plainText(page(pages, resimac));
      for (const doc of ["Full", "Alt"]) {
        rates.push({
          product: `Specialist Clear ${doc} Doc ≤80% LVR`,
          rate: percentage(
            requiredMatch(
              text,
              new RegExp(
                `Specialist Clear ${doc} Doc 24 month fixed rate of ([\\d.]+)%`,
                "u"
              )
            )[1] ?? ""
          ),
          termInMonths: 24,
          sourceUrl: resimac,
          condition:
            "Specialist Clear loans up to 80% LVR; subject to credit assessment and fees.",
        });
      }
      return rates;
    },
  },
];
