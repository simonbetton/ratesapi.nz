import { page, percentage, plainText, requiredMatch } from "./parsing";
import type { DirectSource } from "./types";

const sbs = "https://www.sbsbank.co.nz/everyday/sbs-visa-credit-card";
const flight = "https://www.flightcentremastercard.co.nz/fees-and-charges/";

export const cardSources: DirectSource[] = [
  {
    id: "farmers-cards",
    institution: "farmers-finance",
    dataset: "credit-card-rates",
    urls: ["https://www.farmersfinancecard.co.nz/"],
    parse(pages) {
      const url = "https://www.farmersfinancecard.co.nz/";
      const text = plainText(page(pages, url));
      const values = [
        ...text.matchAll(/Standard Interest Rate of (?<rate>[\d.]+)% p\.a\./gu),
      ].map((match) => percentage(match[1] ?? ""));
      if (values.length !== 2 || new Set(values).size !== 1) {
        throw new Error("Farmers standard rate missing or conflicting");
      }
      const [rate] = values;
      if (rate === undefined) {
        throw new Error("Missing Farmers rate");
      }
      return [{ product: "Farmers Card", rate, sourceUrl: url }];
    },
  },
  {
    id: "sbs-cards",
    institution: "sbs-bank",
    dataset: "credit-card-rates",
    urls: [sbs],
    parse(pages) {
      const text = plainText(page(pages, sbs));
      if (!text.includes("The SBS Visa Credit Card has no annual fee.")) {
        throw new Error("SBS card fee changed");
      }
      return [
        {
          product: "SBS Visa",
          sourceUrl: sbs,
          rate: percentage(
            requiredMatch(
              text,
              /Purchase interest rate: (?<value>[\d.]+)% p\.a\./u
            )[1] ?? ""
          ),
          cashAdvanceRate: percentage(
            requiredMatch(
              text,
              /Cash advance interest rate: (?<value>[\d.]+)% p\.a\./u
            )[1] ?? ""
          ),
          primaryFeeNZD: 0,
          interestFreePeriodInMonths: Number(
            requiredMatch(
              text,
              /Get up to (?<value>\d+) days interest-free on your purchases/u
            )[1]
          ),
        },
      ];
    },
  },
  {
    id: "flight-centre-cards",
    institution: "flight-centre",
    dataset: "credit-card-rates",
    urls: [flight],
    parse(pages) {
      const text = plainText(page(pages, flight));
      return [
        {
          product: "Rewards",
          sourceUrl: flight,
          rate: percentage(
            requiredMatch(
              text,
              /Standard Interest Rate (?<value>[\d.]+)%/u
            )[1] ?? ""
          ),
          cashAdvanceRate: percentage(
            requiredMatch(
              text,
              /Cash Advance Interest Rate (?<value>[\d.]+)%/u
            )[1] ?? ""
          ),
          primaryFeeNZD: Number(
            requiredMatch(
              text,
              /Account Fee An annual fee of \$(?<value>\d+(?:\.\d+)?) applied/u
            )[1]
          ),
        },
      ];
    },
  },
];
