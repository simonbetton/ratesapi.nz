import { page, percentage, plainText, requireCount } from "./parsing";
import type { DirectSource } from "./types";

const cards = [
  [
    "Airpoint Card",
    "https://www.americanexpress.com/nz/credit-cards/airnz-base-credit-card/",
  ],
  [
    "Airpoints Platinum",
    "https://www.americanexpress.com/nz/credit-cards/airpoints-cards/airpoints-platinum-card/",
  ],
  [
    "Low rate",
    "https://www.americanexpress.com/nz/credit-cards/low-rate-credit-card/",
  ],
  [
    "Gold Rewards",
    "https://www.americanexpress.com/nz/credit-cards/gold-credit-card/",
  ],
] as const;

function repeatedValue(text: string, pattern: RegExp): string {
  const [value] = requireCount(
    [...new Set([...text.matchAll(pattern)].map((m) => m[1] ?? ""))],
    1
  );
  if (!value) {
    throw new Error("Missing Amex disclosure value");
  }
  return value;
}

export const amexSources: DirectSource[] = [
  {
    id: "amex-cards",
    institution: "amex",
    dataset: "credit-card-rates",
    urls: cards.map(([, url]) => url),
    parse(pages) {
      return cards.map(([product, sourceUrl]) => {
        const text = plainText(page(pages, sourceUrl));
        const ordinary =
          /Interest Rate: (?<rate>[\d.]+)% p\.a\. on purchases/u.exec(text);
        const promo =
          /Interest Rate: (?<intro>[\d.]+)% p\.a\. for the first (?<months>\d+) months, reverting to (?<rate>[\d.]+)% p\.a\. (?:on )?thereafter/u.exec(
            text
          );
        if (!ordinary && !promo) {
          throw new Error(
            `Unrecognised Amex interest disclosure for ${product}`
          );
        }
        return {
          product,
          sourceUrl,
          rate: percentage(
            repeatedValue(
              text,
              promo
                ? /reverting to (?<rate>[\d.]+)% p\.a\. (?:on )?thereafter/gu
                : /Interest Rate: (?<rate>[\d.]+)% p\.a\. on purchases/gu
            )
          ),
          primaryFeeNZD: Number(
            repeatedValue(text, /Annual Fee: \$(?<fee>[\d.]+) p\.a\./gu)
          ),
          interestFreePeriodInMonths: Number(
            repeatedValue(
              text,
              /Interest Free Period: Up to (?<days>\d+) days/gu
            )
          ),
          condition: promo
            ? `Standard purchase rate. New card members receive ${promo[1]}% p.a. for the first ${promo[2]} months, then the standard rate applies.`
            : "Standard purchase rate; card terms and eligibility apply.",
        };
      });
    },
  },
];
