import { load } from "cheerio";

import { documentLink, pdfText } from "./documents";
import {
  matchingTable,
  page,
  percentage,
  plainText,
  requireCount,
  requiredMatch,
  termMonths,
} from "./parsing";
import type { DirectSource } from "./types";

const christian =
  "https://www.christiansavings.co.nz/churches-and-charities/ministry-loans";
const goldband = "https://goldbandfinance.nz/personal-lending/";
const goldbandDocument =
  /schedule-of-interest_rates_standard-charges-gold-band-finance\.pdf/iu;
const india = "https://bankofindia.co.nz/advances";
const baroda =
  "https://www.barodanzltd.co.nz/rates-and-charges/rate-of-interest-on-loans";

export const discoveredSources: DirectSource[] = [
  {
    id: "bank-of-india-mortgage",
    institution: "bank-of-india",
    dataset: "mortgage-rates",
    urls: [india],
    browser: {
      [india]: {
        selector: "#tbl-dept td",
        minimumRates: 5,
        cloudChallenge: true,
      },
    },
    parse(pages) {
      const html = page(pages, india);
      const [, effective] = requiredMatch(
        plainText(html),
        /HOME LOAN RATES effective From (?<date>\d{2}\/\d{2}\/\d{4})/u
      );
      return requireCount(
        matchingTable(html, /^Option Rate\*/u).slice(1),
        5
      ).map(([term, value]) => ({
        product: term === "Revolving Credit" ? "Revolving Credit" : "Standard",
        rate: percentage(value ?? ""),
        termInMonths:
          term === "Revolving Credit" ? null : termMonths(term ?? ""),
        sourceUrl: india,
        condition: `LVR up to 80%; lending criteria and low-equity adjustments apply. Bank's currently published schedule states effective ${effective}; retrieval does not imply a newly changed rate.`,
      }));
    },
  },
  ...(["personal-loan-rates", "car-loan-rates"] as const).map(
    (dataset): DirectSource => ({
      id: `baroda-${dataset}`,
      institution: "bank-of-baroda",
      dataset,
      urls: [baroda],
      browser: { [baroda]: { selector: "table td", minimumRates: 1 } },
      parse(pages) {
        const $ = load(page(pages, baroda));
        const names =
          dataset === "car-loan-rates"
            ? ["Baroda Car Loan"]
            : [
                "Education Loan scheme for students going abroad",
                "Personal Loan for Salaried Employees / Baroda Overdraft Advantage",
              ];
        return names.map((product) => {
          const rows = $("tr")
            .toArray()
            .filter(
              (row) =>
                $(row)
                  .find("td")
                  .first()
                  .text()
                  .replaceAll(/\s+/gu, " ")
                  .trim() === product
            );
          const [row] = requireCount(rows, 1);
          const text = $(row).find("td").eq(1).text().replaceAll(/\s+/gu, " ");
          const match = requiredMatch(
            text,
            /Floating (?<margin>[\d.]+)% above Bank Base Lending Rate \(BBLR\); Present BBLR: (?<base>[\d.]+)%/u
          );
          const margin = percentage(match[1] ?? "");
          const base = percentage(match[2] ?? "");
          return {
            product,
            rate: Number((base + margin).toFixed(4)),
            sourceUrl: baroda,
            condition: `Floating rate calculated from the published BBLR of ${base}% plus ${margin} percentage points. Lending criteria and fees apply.`,
          };
        });
      },
    })
  ),
  {
    id: "christian-savings-mortgage",
    institution: "christian-savings",
    dataset: "mortgage-rates",
    urls: [christian],
    parse(pages) {
      const $ = load(page(pages, christian));
      if ($("#Product .label").text().trim() !== "Ministry loan") {
        throw new Error("Expected Ministry loan rate panel");
      }
      return requireCount($("#Product .rate-wrap").toArray(), 2).map((row) => ({
        product: "Ministry Loan",
        termInMonths: termMonths(
          $(row)
            .find(".rate-name")
            .text()
            .replace(/ Fixed$/u, "")
        ),
        rate: percentage($(row).find(".interest-rate---rate-wrap").text()),
        sourceUrl: christian,
        condition:
          "For ministry workers and employees of registered Christian charities working at least 24 hours or three days per week. Lending criteria, security requirements and fees apply. Co-ownership deposits are not interest rates.",
      }));
    },
  },
  ...(["personal-loan-rates", "car-loan-rates"] as const).map(
    (dataset): DirectSource => ({
      id: `gold-band-${dataset}`,
      institution: "gold-band-finance",
      dataset,
      urls: [goldband],
      discover: (pages) => [documentLink(pages, goldband, goldbandDocument)],
      parse(pages) {
        const sourceUrl = documentLink(pages, goldband, goldbandDocument);
        const text = pdfText(pages, sourceUrl);
        const [, effective] = requiredMatch(
          text,
          /Effective (?<date>\d{1,2} \w+ \d{4})/u
        );
        const match = requiredMatch(
          text,
          /Gold Band Finance interest rates range between (?<rate>[\d.]+)% and (?<maximum>[\d.]+)%/u
        );
        return [
          {
            product:
              dataset === "car-loan-rates" ? "Car Loan" : "Personal Loan",
            rate: percentage(match[1] ?? ""),
            rateMaximum: percentage(match[2] ?? ""),
            rateType: "range",
            sourceUrl,
            condition: `Published consumer-loan range depends on security, credit history, affordability, amount and term. Establishment and ongoing fees apply. The currently linked disclosure is effective ${effective}.`,
          },
        ];
      },
    })
  ),
];
