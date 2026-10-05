import { page, percentage, plainText, requiredMatch } from "./parsing";
import type { DirectSource } from "./types";

const midlands = "https://investmidlands.co.nz/faqs/";
const nzvf = "https://www.nzvehiclefinance.co.nz/page/disclosure-information/";

export const finalSources: DirectSource[] = [
  {
    id: "midlands-mortgage",
    institution: "midlands-mortgage-trust",
    dataset: "mortgage-rates",
    urls: [midlands],
    parse(pages) {
      const match = requiredMatch(
        plainText(page(pages, midlands)),
        /What interest rate do you charge borrowers\? Our interest rates are floating and currently start at (?<rate>[\d.]+)% per annum/u
      );
      return [
        {
          product: "First Mortgage",
          rate: percentage(match[1] ?? ""),
          rateType: "from",
          termInMonths: null,
          sourceUrl: midlands,
          condition:
            "First mortgage from $400,000 for up to two years. Actual rate depends on financial circumstances, security, LVR, credit history and exit strategy; fees apply.",
        },
      ];
    },
  },
  {
    id: "nz-vehicle-finance-car",
    institution: "nz-vehicle-finance",
    dataset: "car-loan-rates",
    urls: [nzvf],
    parse(pages) {
      const match = requiredMatch(
        plainText(page(pages, nzvf)),
        /When New Zealand Vehicle Finance arranges vehicle or personal finance for you, it will fall within a fixed interest rate range of (?<rate>[\d.]+)% and (?<maximum>[\d.]+)%/u
      );
      return [
        {
          product: "Car Loan",
          plan: "Secured",
          rate: percentage(match[1] ?? ""),
          rateMaximum: percentage(match[2] ?? ""),
          rateType: "range",
          sourceUrl: nzvf,
          condition:
            "Fixed rate from NZ Vehicle Finance's consumer credit disclosure; individual rate depends on amount, income, term, commitments and credit history. Fees apply.",
        },
      ];
    },
  },
];
