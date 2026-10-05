import { load } from "cheerio";

import { page, percentage, plainText, requiredMatch } from "./parsing";
import type { DirectSource, Observation } from "./types";

const feed = "https://www.anz.co.nz/bin/anzconz/rates/?format=JSON";
const mortgagePage = "https://www.anz.co.nz/rates-fees-agreements/home-loans/";
const renoPage =
  "https://www.anz.co.nz/personal/home-loans-mortgages/loan-types/reno/";
const personalPage =
  "https://www.anz.co.nz/rates-fees-agreements/personal-loans/";
const cardsPage = "https://www.anz.co.nz/rates-fees-agreements/credit-cards/";

interface AnzRate {
  code: string;
  isactive: string;
  ratevalue: string;
}

function ratesForPage(
  pages: ReadonlyMap<string, string>,
  url: string
): (code: string) => number {
  const json: unknown = JSON.parse(page(pages, feed));
  if (!Array.isArray(json)) {
    throw new TypeError("ANZ rate feed is not an array");
  }
  const html = page(pages, url);
  return (code) => {
    const matches = json.filter((item: AnzRate) => item.code === code);
    const row: AnzRate | undefined = matches[0];
    // The feed includes old and unpublished rates. Only use codes on the current product page.
    // isfordisplay is NOT a publication flag: live Special mortgage rates use "0".
    if (
      matches.length !== 1 ||
      !row ||
      row.isactive !== "1" ||
      !(html.includes(`/${code}\\"`) || html.includes(`"id":"${code}"`))
    ) {
      throw new Error(
        `ANZ ${code} is missing, inactive, duplicated, or absent from its product page`
      );
    }
    return percentage(row.ratevalue);
  };
}

export const anzSources: DirectSource[] = [
  {
    id: "anz-mortgage",
    institution: "anz",
    dataset: "mortgage-rates",
    urls: [mortgagePage, renoPage, feed],
    parse(pages) {
      const value = ratesForPage(pages, mortgagePage);
      const standard: [number | null, string][] = [
        [null, "HVRNZI"],
        [6, "HFRNZ6MI"],
        [12, "HFRNZ1I"],
        [18, "HFRNZ18MI"],
        [24, "HFRNZ2I"],
        [36, "HFRNZ3I"],
        [48, "HFRN4I"],
        [60, "HFRNZ5I"],
      ];
      const special: [number, string][] = [
        [6, "HFRNZ6MILE"],
        [12, "HFRNZ1ILE"],
        [18, "HFRNZ18MIL"],
        [24, "HFRNZ2ILE"],
        [36, "HFRNZ3ILE"],
      ];
      return [
        ...standard.map(([termInMonths, code]) => ({
          product: "Standard",
          termInMonths,
          rate: value(code),
          sourceUrl: mortgagePage,
        })),
        ...special.map(([termInMonths, code]) => ({
          product: "Special",
          termInMonths,
          rate: value(code),
          sourceUrl: mortgagePage,
          condition:
            "Minimum 20% equity; ANZ lending and eligibility criteria apply.",
        })),
        {
          product: "Good Energy - Up to $80K",
          termInMonths: 36,
          rate: value("HFRNZIGE"),
          sourceUrl: mortgagePage,
          condition: "Eligible Good Energy home loan top-ups only.",
        },
        {
          product: "Flexible",
          termInMonths: null,
          rate: value("HFPNZI"),
          sourceUrl: mortgagePage,
        },
        {
          product: "Reno loan - Up to $50K",
          termInMonths: 36,
          rate: ratesForPage(pages, renoPage)("HFRNZRL"),
          sourceUrl: renoPage,
          condition:
            "Eligible renovations only; $3,000–$50,000 top-up to an ANZ Home Loan. Minimum 20% equity for owner occupiers, 30% for investment properties.",
        },
      ];
    },
  },
  {
    id: "anz-personal",
    institution: "anz",
    dataset: "personal-loan-rates",
    urls: [personalPage, feed],
    parse(pages) {
      const value = ratesForPage(pages, personalPage);
      const lower = value("PLVRNZLI");
      const upper = value("PLVRNZHI");
      if (lower !== upper) {
        throw new Error(
          "ANZ personal loan tiers now differ; review loan amount conditions"
        );
      }
      return [
        {
          product: "Personal Loan",
          rate: lower,
          plan: "Unsecured",
          condition:
            "$3,000 to $50,000; $1,000 minimum for eligible Jumpstart customers.",
          sourceUrl: personalPage,
        },
      ];
    },
  },
  {
    id: "anz-cards",
    institution: "anz",
    dataset: "credit-card-rates",
    urls: [cardsPage, feed],
    parse(pages) {
      const value = ratesForPage(pages, cardsPage);
      const cards = [
        ["Low Rate", "NZLIVP", "NZLIVC", "ANZ Low Rate Visa"],
        ["Airpoints Visa", "NZAPCP", "NZAPCC", "ANZ Airpoints Visa"],
        [
          "Airpoints Visa Platinum",
          "NZAPPP",
          "NZAPPC",
          "ANZ Airpoints Visa Platinum",
        ],
        ["CashBack", "NZCVP", "NZCVC", "ANZ CashBack Visa"],
        ["CashBack Platinum", "NZCVPP", "NZCVPC", "ANZ CashBack Visa Platinum"],
      ];
      return cards.map(([product, purchase, cash, title]): Observation => {
        if (!product || !purchase || !cash || !title) {
          throw new Error("Invalid ANZ card mapping");
        }
        return {
          product,
          rate: value(purchase),
          cashAdvanceRate: value(cash),
          sourceUrl: cardsPage,
          primaryFeeNZD: primaryFee(page(pages, cardsPage), title),
          ...(product === "Low Rate"
            ? {
                balanceTransferRate: value("NZALIVBT"),
                balanceTransferPeriod: "24 months",
              }
            : {}),
        };
      });
    },
  },
];

function primaryFee(html: string, title: string): number {
  const $ = load(html);
  const scripts = $("script:not([src])")
    .toArray()
    .map((node) => $(node).text())
    .filter((text) => text.trim().startsWith('{"rootModel"'));
  if (scripts.length !== 1) {
    throw new Error("ANZ page model missing or duplicated");
  }
  const bodies: string[] = [];
  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      for (const child of node) {
        visit(child);
      }
    } else if (node !== null && typeof node === "object") {
      const object = node as Record<string, unknown>;
      if (object.title === title && typeof object.body === "string") {
        bodies.push(plainText(object.body));
      }
      for (const child of Object.values(object)) {
        visit(child);
      }
    }
  }
  visit(JSON.parse(scripts[0] ?? ""));
  if (bodies.length !== 1) {
    throw new Error(`Missing ANZ primary fee for ${title}`);
  }
  const text = bodies[0] ?? "";
  if (/Primary card fee - No charge/u.test(text)) {
    return 0;
  }
  const match = requiredMatch(
    text,
    /Primary card fee - \$(?<value>\d+(?:\.\d+)?) (?<frequency>half[- ]yearly|p\.a\.)/u
  );
  return Number(match[1]) * (match[2] === "p.a." ? 1 : 2);
}
