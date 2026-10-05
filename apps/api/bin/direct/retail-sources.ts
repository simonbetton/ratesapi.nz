import { page, percentage, plainText, requiredMatch } from "./parsing";
import type { DirectSource } from "./types";

const gemCard = "https://www.gemfinance.co.nz/credit-cards/gem-visa-card/";
const gold =
  "https://www.asb.co.nz/content/asb/constant-collection/en/constant-collection/visa.constantsapi.html";
const udc = "https://www.udc.co.nz/for-individuals/cars";
const ballantynes =
  "https://www.ballantynes.co.nz/ballantynes-account-card.html";

export const retailSources: DirectSource[] = [
  ...(["personal-loan-rates", "car-loan-rates"] as const).map(
    (dataset): DirectSource => {
      const url = `https://www.gemfinance.co.nz/loans/${dataset === "car-loan-rates" ? "car" : "personal"}-loans/`;
      return {
        id: `gem-${dataset}`,
        institution: "gem",
        dataset,
        urls: [url],
        parse(pages) {
          const text = plainText(page(pages, url));
          return ["Fixed", "Variable"].flatMap((kind) => {
            const section = requiredMatch(
              text,
              new RegExp(
                `${kind} Loans - ([\\d.]+)% p.a. to ([\\d.]+)% p.a. for Secured Loans and ([\\d.]+)% p.a. to ([\\d.]+)% p.a. for Unsecured loans`,
                "u"
              )
            );
            return ["Secured", "Unsecured"].map((plan, i) => ({
              product: `${kind} ${dataset === "car-loan-rates" ? "Car" : "Personal"} Loan`,
              plan,
              rate: percentage(section[i * 2 + 1] ?? ""),
              rateMaximum: percentage(section[i * 2 + 2] ?? ""),
              rateType: "range",
              sourceUrl: url,
              condition: `${kind} annual rate depends on personal circumstances and credit assessment. Establishment fee applies.`,
            }));
          });
        },
      };
    }
  ),
  {
    id: "gem-cards",
    institution: "gem",
    dataset: "credit-card-rates",
    urls: [gemCard],
    parse(pages) {
      const text = plainText(page(pages, gemCard));
      const rates = requiredMatch(
        text,
        /Prevailing interest rate \(currently Gem Visa (?<visa>[\d.]+)% p\.a\.\/Gem CreditLine (?<line>[\d.]+)% p\.a\.\)/u
      );
      const fees = requiredMatch(
        text,
        /annual fees \(\$(?<visa>[\d.]+) Gem Visa \(charged \$[\d.]+ half yearly\)\/\$(?<line>[\d.]+) Gem CreditLine/u
      );
      const cash = requiredMatch(
        text,
        /For cash advances, an interest rate of (?<rate>[\d.]+)% p\.a\./u
      );
      return ["Gem Visa", "Credit Line"].map((product, i) => ({
        product,
        rate: percentage(rates[i + 1] ?? ""),
        primaryFeeNZD: Number(fees[i + 1]),
        cashAdvanceRate: percentage(cash[1] ?? ""),
        sourceUrl: gemCard,
        condition:
          "Standard rate applies after any interest-free plan expires. Qualifying purchases may have a promotional interest-free period; minimum repayments may not clear the balance before expiry.",
      }));
    },
  },
  {
    id: "asb-gold",
    institution: "asb",
    dataset: "credit-card-rates",
    urls: [gold],
    parse(pages) {
      const data: {
        value: { key: string; interestRate?: string; fees?: string }[];
      } = JSON.parse(page(pages, gold));
      function value(label: string, field: "interestRate" | "fees"): string {
        const rows = data.value.filter(
          (r) => r.key === `Visa Gold Rewards ${label}`
        );
        if (rows.length !== 1 || !rows[0]?.[field]) {
          throw new Error(`Missing ASB Gold ${label}`);
        }
        return rows[0][field];
      }
      return [
        {
          product: "Gold",
          rate: percentage(
            value("Purchase interest rate - 360 Months", "interestRate")
          ),
          cashAdvanceRate: percentage(
            value("Cash advance interest rate - 360 Months", "interestRate")
          ),
          primaryFeeNZD:
            Number(value("Individual account fee - 6 Months", "fees")) * 2,
          sourceUrl: gold,
          condition:
            "ASB Visa Gold Rewards rate and fee from the public first-party feed used by ASB's card pages.",
        },
      ];
    },
  },
  {
    id: "udc-car",
    institution: "udc",
    dataset: "car-loan-rates",
    urls: [udc],
    browser: { [udc]: { selector: "li", minimumRates: 1 } },
    parse(pages) {
      const match = requiredMatch(
        plainText(page(pages, udc)),
        /Interest rates from (?<rate>[\d.]+)% p\.a\. to (?<maximum>[\d.]+)% p\.a\./u
      );
      return [
        {
          product: "Car Loan",
          plan: "Secured",
          rate: percentage(match[1] ?? ""),
          rateMaximum: percentage(match[2] ?? ""),
          rateType: "range",
          sourceUrl: udc,
          condition:
            "Car finance; subject to responsible lending assessment, eligibility criteria, terms and fees.",
        },
      ];
    },
  },
  {
    id: "ballantynes-cards",
    institution: "ballantynes",
    dataset: "credit-card-rates",
    urls: [ballantynes],
    parse(pages) {
      const match = requiredMatch(
        plainText(page(pages, ballantynes)),
        /The current interest rate is (?<rate>[\d.]+) percent per annum, with minimum payment terms required/u
      );
      return [
        {
          product: "Ballantynes Card",
          rate: percentage(match[1] ?? ""),
          sourceUrl: ballantynes,
          condition:
            "Store account card; interest applies to overdue balances and minimum payment terms apply. Consult the account disclosure for payment timing.",
        },
      ];
    },
  },
];
