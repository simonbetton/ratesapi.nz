import {
  page,
  percentage,
  plainText,
  requireCount,
  requiredMatch,
  termMonths,
} from "./parsing";
import type { DirectSource, Observation } from "./types";

const ratesUrl =
  "https://www.co-operativebank.co.nz/api/content/content/website/rates";
const loanUrl =
  "https://www.co-operativebank.co.nz/api/content/content/website/borrowing/personal-loans";
const cardUrl =
  "https://www.co-operativebank.co.nz/api/content/content/website/cards-and-payments/our-cards/credit-card";

interface RateRow {
  description: string;
  rateAsString: string;
}
interface GenericRate {
  label: string;
  amount: string;
}
interface RatesPage {
  slots: {
    homeLoans: { content: { data: RateRow[] } };
    lowEquityRates: { content: { data: RateRow[] } };
    personalLoans: {
      content: { rates: { title: string; rates: GenericRate[] } };
    };
    creditCards: {
      content: { rates: { title: string; rates: GenericRate[] } };
    };
  };
}

export const cooperativeSources: DirectSource[] = [
  {
    id: "cooperative-mortgage",
    institution: "co-operative-bank",
    dataset: "mortgage-rates",
    urls: [ratesUrl],
    parse(pages) {
      const json: RatesPage = JSON.parse(page(pages, ratesUrl));
      const rates: Observation[] = [];
      for (const [rows, name] of [
        [json.slots.homeLoans.content.data, "Owner Occupied"],
        [json.slots.lowEquityRates.content.data, "Standard"],
      ] as const) {
        for (const row of rows) {
          const revolving = row.description === "Revolving Credit Facility";
          const fresh = row.description.startsWith("Fresh Start - ");
          const term = row.description
            .replace(/^Fresh Start - /u, "")
            .replace(/^Fixed\s*[-–]?\s*/u, "");
          let product: string = name;
          if (revolving) {
            product = `${name} Revolving Credit`;
          } else if (fresh) {
            product = "Fresh Start";
          }
          rates.push({
            product,
            termInMonths: revolving ? null : termMonths(term),
            rate: percentage(row.rateAsString),
            sourceUrl: ratesUrl,
            condition:
              name === "Standard"
                ? "Standard rates; a low-equity premium may also apply. Revolving credit is unavailable for low-equity loans."
                : "Owner-occupied lending with at least 20% equity, or eligible First Home Loans.",
          });
        }
      }
      // Despite the CMS slot name, this is a mortgage offer. Validate the title before interpreting it.
      const firstHome = json.slots.personalLoans.content.rates;
      if (
        firstHome.title !==
        "Home Loan - First Home Buyer Special Rates - Owner Occupied"
      ) {
        throw new Error("Co-operative Bank first home offer changed");
      }
      for (const row of firstHome.rates) {
        rates.push({
          product: "First Home Buyer Special",
          termInMonths: termMonths(row.label.replace(/^Fixed\s*[-–]\s*/u, "")),
          rate: percentage(row.amount),
          sourceUrl: ratesUrl,
          condition:
            "Owner-occupied first home; new lending from $250,000, minimum 20% equity or eligible Kainga Ora First Home Loan.",
        });
      }
      return requireCount(rates, 27);
    },
  },
  ...(["personal-loan-rates", "car-loan-rates"] as const).map(
    (dataset): DirectSource => ({
      id: `cooperative-${dataset}`,
      institution: "co-operative-bank",
      dataset,
      urls: [loanUrl],
      parse(pages) {
        const json: {
          slots: {
            overlapSlot: { content: { rightFeature: { tagline: string } } };
          };
        } = JSON.parse(page(pages, loanUrl));
        const text = json.slots.overlapSlot.content.rightFeature.tagline;
        const match = requiredMatch(
          text,
          /rates ranging from (?<value>[\d.]+)% to (?<maximum>[\d.]+)% p\.a\./iu
        );
        return [
          {
            product:
              dataset === "car-loan-rates" ? "Vehicle Loan" : "Personal Loan",
            rate: percentage(match[1] ?? ""),
            rateMaximum: percentage(match[2] ?? ""),
            rateType: "range",
            sourceUrl: loanUrl,
            condition:
              "$3,000 to $50,000, terms from 6 months to 5 years; subject to assessment.",
          },
        ];
      },
    })
  ),
  {
    id: "cooperative-cards",
    institution: "co-operative-bank",
    dataset: "credit-card-rates",
    urls: [ratesUrl, cardUrl],
    parse(pages) {
      const json: RatesPage = JSON.parse(page(pages, ratesUrl));
      const card = json.slots.creditCards.content.rates;
      if (card.title !== "Fair Rate Credit Card") {
        throw new Error("Co-operative Bank card name changed");
      }
      function rateFor(label: string): number {
        const matches = card.rates.filter((row) => row.label === label);
        return percentage(requireCount(matches, 1)[0]?.amount ?? "");
      }
      const details: {
        slots: {
          slot6: {
            content: {
              items: {
                section: { fees: { display: string; value: string }[] };
              }[];
            };
          };
          slot1: { content: { body: string } };
        };
      } = JSON.parse(page(pages, cardUrl));
      const fees = details.slots.slot6.content.items.flatMap(
        (item) => item.section.fees
      );
      const primaryFee =
        requireCount(
          fees.filter(
            (fee) => fee.display === "Account fee (Primary card holder only)"
          ),
          1
        )[0]?.value ?? "";
      const feeMatch = requiredMatch(
        plainText(primaryFee),
        /\$(?<value>\d+(?:\.\d+)?)\s*(?:every six months|every 6 months|six monthly)/iu
      );
      const days = requiredMatch(
        plainText(details.slots.slot1.content.body),
        /You can enjoy up to (?<value>\d+) days interest/iu
      );
      return [
        {
          product: "Fair Rate",
          rate: rateFor("Purchase interest rate"),
          cashAdvanceRate: rateFor("Cash advance interest rate"),
          balanceTransferRate: rateFor("Balance transfer (6 months)*"),
          balanceTransferPeriod: "6 months",
          primaryFeeNZD: Number(feeMatch[1]) * 2,
          interestFreePeriodInMonths: Number(days[1]),
          sourceUrl: cardUrl,
        },
      ];
    },
  },
];
