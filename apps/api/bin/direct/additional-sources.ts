import type { DataType } from "../../src/lib/data-loader";
import {
  matchingTable,
  page,
  percentage,
  plainText,
  requireCount,
  requiredMatch,
  termMonths,
} from "./parsing";
import type { DirectSource, Observation } from "./types";

const financeNow = "https://www.financenow.co.nz/personal-loans/";
const financeNowCard = "https://www.financenow.co.nz/credit-cards/now-rewards/";
const paraloan = "https://www.paraloan.org.nz/26/costs-of-borrowing";
const westpacLoan = "https://www.westpac.co.nz/personal-loans/";
const westpacEv = "https://www.westpac.co.nz/personal-loans/ev-loan/";
const wbs = "https://wbs.net.nz/home-loans/";
const hbs = "https://www.heretaungabuildingsociety.co.nz/borrow/";
const fmt = "https://fmt.co.nz/lending-criteria-and-rates/";
const general = "https://generalfinance.co.nz/loans/";
const welcome = "https://www.welcome.co.nz/borrow/";

function single(
  institution: string,
  dataset: DataType,
  url: string,
  product: string,
  pattern: RegExp,
  details: Partial<Observation> = {}
): DirectSource {
  return {
    id: `${institution}-${dataset}`,
    institution,
    dataset,
    urls: [url],
    parse(pages) {
      const match = requiredMatch(plainText(page(pages, url)), pattern);
      const rate = percentage(match[1] ?? "");
      return [
        {
          product,
          sourceUrl: url,
          rate,
          ...details,
          ...(match[2]
            ? { rateMaximum: percentage(match[2]), rateType: "range" as const }
            : {}),
        },
      ];
    },
  };
}

function financeNowSource(
  dataset: "personal-loan-rates" | "car-loan-rates"
): DirectSource {
  return {
    id: `finance-now-${dataset}`,
    institution: "finance-now",
    dataset,
    urls: [financeNow],
    parse(pages) {
      const text = plainText(page(pages, financeNow));
      const match = requiredMatch(
        text,
        /Interest rates for personal loans range from (?<rate>[\d.]+)% to (?<maximum>[\d.]+)% p\.a\. until (?<expiry>\d{1,2} [A-Za-z]+ \d{4})/u
      );
      const expiry = match[3] ?? "";
      const expiresAt = Date.parse(`${expiry} 23:59:59 GMT+1300`);
      if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
        throw new Error(
          "Finance Now promotion has expired; review current disclosure"
        );
      }
      return [
        {
          product: "Personal Loan",
          sourceUrl: financeNow,
          rate: percentage(match[1] ?? ""),
          rateMaximum: percentage(match[2] ?? ""),
          rateType: "range",
          condition: `Promotional fixed rates for applications through ${expiry}; subject to credit assessment. Secured or unsecured personal loan${dataset === "car-loan-rates" ? " for vehicle purchase" : ""}.`,
        },
      ];
    },
  };
}

export const additionalSources: DirectSource[] = [
  single(
    "aotea-finance",
    "personal-loan-rates",
    "https://aoteafinance.co.nz/costs-of-borrowing/",
    "Personal Loan",
    /Annual Interest Rate is fixed for the whole contract being from (?<rate>[\d.]+)% to (?<maximum>[\d.]+)%/u,
    {
      condition:
        "Fixed rate depends on individual credit assessment; default interest excluded.",
    }
  ),
  financeNowSource("personal-loan-rates"),
  financeNowSource("car-loan-rates"),
  {
    id: "finance-now-cards",
    institution: "finance-now",
    dataset: "credit-card-rates",
    urls: [financeNowCard],
    parse(pages) {
      const text = plainText(page(pages, financeNowCard));
      return [
        {
          product: "NOW Rewards Visa",
          sourceUrl: financeNowCard,
          rate: percentage(
            requiredMatch(
              text,
              /(?<rate>[\d.]+)\s*% p\.a\.Purchase interest rate/u
            )[1] ?? ""
          ),
          cashAdvanceRate: percentage(
            requiredMatch(
              text,
              /(?<rate>[\d.]+)\s*% p\.a\.Cash advance interest rate/u
            )[1] ?? ""
          ),
          primaryFeeNZD:
            Number(
              requiredMatch(text, /\$(?<fee>[\d.]+)6-monthly account fee/u)[1]
            ) * 2,
        },
      ];
    },
  },
  single(
    "paraloan",
    "mortgage-rates",
    paraloan,
    "For people with physical disabilities....from",
    /Home loans are between (?<rate>[\d.]+)% and (?<maximum>[\d.]+)%/u,
    {
      termInMonths: null,
      term: "By agreement",
      condition:
        "Applicants with physical disabilities; security and access to other funding affect the rate. First or second mortgage.",
    }
  ),
  single(
    "paraloan",
    "personal-loan-rates",
    paraloan,
    "For people with physical disabilities",
    /Unsecured loans are (?<rate>[\d.]+)%/u,
    {
      plan: "Unsecured",
      condition:
        "Applicants with physical disabilities; subject to Paraloan eligibility and lending approval.",
    }
  ),
  single(
    "paraloan",
    "car-loan-rates",
    paraloan,
    "For people with physical disabilities",
    /Car loans are between (?<rate>[\d.]+)% and (?<maximum>[\d.]+)%/u,
    {
      plan: "Secured",
      condition:
        "Applicants with physical disabilities; property security preferred, vehicle security considered with guarantee.",
    }
  ),
  ...(["personal-loan-rates", "car-loan-rates"] as const).map(
    (dataset): DirectSource => ({
      id: `westpac-${dataset}`,
      institution: "westpac",
      dataset,
      urls: [westpacLoan, westpacEv],
      browser: {
        [westpacLoan]: { selector: "p", minimumRates: 1 },
        [westpacEv]: { selector: "p", minimumRates: 1 },
      },
      parse(pages) {
        const standard = requiredMatch(
          plainText(page(pages, westpacLoan)),
          /Westpac standard personal loan interest rate of (?<rate>[\d.]+)% p\.a\./u
        );
        const ev = requiredMatch(
          plainText(page(pages, westpacEv)),
          /Our EV personal loan allows you to borrow at a low interest rate of (?<rate>[\d.]+)%/u
        );
        return [
          {
            product: "Personal Loan",
            rate: percentage(standard[1] ?? ""),
            sourceUrl: westpacLoan,
            plan: "Unsecured",
            condition:
              "Variable personal loan rate; standard lending criteria apply.",
          },
          {
            product: "EVs and e-Bikes",
            rate: percentage(ev[1] ?? ""),
            sourceUrl: westpacEv,
            plan: "Unsecured",
            condition:
              "Variable rate for eligible electric/hybrid cars, e-mopeds and e-bikes; Westpac transaction account required.",
          },
        ];
      },
    })
  ),
  {
    id: "wbs-mortgage",
    institution: "wairarapa-bldg-society",
    dataset: "mortgage-rates",
    urls: [wbs],
    parse(pages) {
      return requireCount(
        matchingTable(page(pages, wbs), /^Term Rate/u).slice(1),
        4
      ).map(([term, rate]) => ({
        product: "Residential Standard",
        rate: percentage(rate ?? ""),
        termInMonths: termMonths((term ?? "").replace(/^Fixed /u, "")),
        sourceUrl: wbs,
        condition:
          "Standard residential rate; margins of 0.50% to 2.00% can apply in some circumstances.",
      }));
    },
  },
  {
    id: "hbs-mortgage",
    institution: "heretaunga-bldg-socy",
    dataset: "mortgage-rates",
    urls: [hbs],
    parse(pages) {
      const text = plainText(page(pages, hbs));
      const match = requiredMatch(
        text,
        /Mortgage rates Floating (?<floating>[\d.]+)% Fixed 1 year\s*(?<one>[\d.]+)% Fixed 2 years\s*(?<two>[\d.]+)%/u
      );
      return [null, 12, 24].map((termInMonths, index) => ({
        product: "Residential",
        rate: percentage(match[index + 1] ?? ""),
        termInMonths,
        sourceUrl: hbs,
      }));
    },
  },
  {
    id: "fmt-mortgage",
    institution: "first-mortgage-trust",
    dataset: "mortgage-rates",
    urls: [fmt],
    parse(pages) {
      const text = plainText(page(pages, fmt));
      return ["Standard", "Development"].map((name) => ({
        product: `${name} - from`,
        rate: percentage(
          requiredMatch(
            text,
            new RegExp(
              `${name} Loans: from ([\\d.]+)% on lending up to \\$5m`,
              "u"
            )
          )[1] ?? ""
        ),
        rateType: "from",
        termInMonths: null,
        term: "By agreement",
        condition:
          "Loans up to $5 million; actual rate depends on credit assessment and security. Larger loans are priced individually.",
        sourceUrl: fmt,
      }));
    },
  },
  single(
    "general-finance",
    "mortgage-rates",
    general,
    "Short term bridging 1st mortgages ....from",
    /RatesInterest Rate\(where a first mortgage residential security is taken\) from (?<rate>[\d.]+)%/u,
    {
      rateType: "from",
      termInMonths: null,
      term: "By agreement",
      condition:
        "First mortgage over residential property; non-CCCFA lending. Loan terms up to three years.",
    }
  ),
  {
    id: "welcome-mortgage",
    institution: "welcome",
    dataset: "mortgage-rates",
    urls: [welcome],
    parse(pages) {
      const text = plainText(page(pages, welcome));
      const fixed =
        requiredMatch(
          text,
          /Residential Fixed Rates\. (?<rows>.+?) Commercial Fixed Rates\./u
        )[1] ?? "";
      const matches = requireCount(
        [
          ...fixed.matchAll(
            /(?<term>\d+ (?:months|years)) - from (?<rate>[\d.]+)%/gu
          ),
        ],
        4
      );
      const rates: Observation[] = matches.map((match) => ({
        product: "Short-term first mortgages from:",
        rate: percentage(match[2] ?? ""),
        rateType: "from",
        termInMonths: termMonths(match[1] ?? ""),
        sourceUrl: welcome,
        condition:
          "Residential property; up to 70% LVR plus fees. Non-CCCFA lending through mortgage advisers; subject to credit assessment.",
      }));
      rates.push({
        product: "Short-term first mortgages from:",
        sourceUrl: welcome,
        rateType: "from",
        condition:
          "Residential property; up to 70% LVR plus fees. Non-CCCFA lending through mortgage advisers; subject to credit assessment.",
        rate: percentage(
          requiredMatch(
            text,
            /Residential Variable Rate \(3-12 months\) - from (?<rate>[\d.]+)%/u
          )[1] ?? ""
        ),
        termInMonths: null,
      });
      return rates;
    },
  },
];
