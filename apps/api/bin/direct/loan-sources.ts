import type { DataType } from "../../src/lib/data-loader";
import { page, percentage, plainText, requiredMatch } from "./parsing";
import type { BrowserReadiness, DirectSource, Observation } from "./types";

interface LoanRule {
  product: string;
  plan: string | null;
  pattern: RegExp;
  condition?: string;
}

function rangeSource(
  institution: string,
  dataset: DataType,
  url: string,
  rules: LoanRule[],
  browser?: BrowserReadiness
): DirectSource {
  return {
    id: `${institution}-${dataset}`,
    institution,
    dataset,
    urls: [url],
    ...(browser ? { browser: { [url]: browser } } : {}),
    parse(pages) {
      const text = plainText(page(pages, url));
      return rules.map((rule): Observation => {
        const match = requiredMatch(text, rule.pattern);
        const rate = percentage(match[1] ?? "");
        const rateMaximum = percentage(match[2] ?? "");
        if (rateMaximum < rate) {
          throw new Error(`Inverted range for ${rule.product}`);
        }
        return {
          product: rule.product,
          plan: rule.plan,
          condition:
            rule.condition ??
            "Rate depends on the lender's assessment of your application.",
          rate,
          rateMaximum,
          rateType: "range",
          sourceUrl: url,
        };
      });
    },
  };
}

const mtf =
  "https://www.mtf.co.nz/important-information/interest-rates-and-fees";
const mtfSecured =
  /against an asset, such as a vehicle, our interest rates range from (?<value>[\d.]+)% to (?<maximum>[\d.]+)% per year/iu;
const mtfUnsecured =
  /Unsecured loans range from (?<value>[\d.]+)% to (?<maximum>[\d.]+)% per year/iu;
const geneva = "https://www.genevafinance.co.nz/important-information";
const genevaRange =
  /Our annual interest rates range from (?<value>[\d.]+)% to (?<maximum>[\d.]+)% depending on your credit profile/iu;
const instant = "https://instantfinance.co.nz/key-information/rates-fees/";
const instantRange =
  /Instant Finance provides loans at an annual interest rate from (?<value>[\d.]+)% to (?<maximum>[\d.]+)% per annum/iu;
const avanti = "https://www.avantifinance.co.nz/rates-fees/";
const aa = "https://www.aamoney.co.nz/our-pricing/";

export const loanSources: DirectSource[] = [
  rangeSource(
    "future-finance",
    "personal-loan-rates",
    "https://www.futurefinance.co.nz/interest-rates",
    [
      {
        product: "Personal Loan",
        plan: null,
        pattern:
          /Our interest rates are fixed and range from (?<value>[\d.]+)% – (?<maximum>[\d.]+)% p\.a\./iu,
      },
    ]
  ),
  rangeSource(
    "gilrose-finance",
    "personal-loan-rates",
    "https://www.gilrose.co.nz/personal-loans/rates-and-fees",
    [
      {
        product: "Personal Loan",
        plan: null,
        pattern:
          /Our Personal Loan Interest Rates range from (?<value>[\d.]+)%\* to (?<maximum>[\d.]+)% for a Gilrose Personal Loan/iu,
        condition:
          "Lower rates apply for secured loans; standard fixed term rates depend on assessment.",
      },
    ],
    { selector: "body", minimumRates: 1 }
  ),
  rangeSource(
    "nova-medical-finance",
    "personal-loan-rates",
    "https://www.novamedical.co.nz/interest-rates-disclosure",
    [
      {
        product: "Personal loan",
        plan: null,
        pattern:
          /personalised interest rates currently ranging from (?<value>[\d.]+)% up to (?<maximum>[\d.]+)% per annum/iu,
      },
    ]
  ),
  rangeSource(
    "quick-cash-finance",
    "personal-loan-rates",
    "https://quickcash.co.nz/",
    [
      {
        product: "Personal Loan",
        plan: null,
        pattern:
          /Our loans are based on an AIR of (?<value>[\d.]+)% - (?<maximum>[\d.]+)% subject to customer credit profile and security/iu,
      },
    ]
  ),
  rangeSource(
    "cfs-finance",
    "car-loan-rates",
    "https://www.cfsfinance.co.nz/disclosure-info/interests/",
    [
      {
        product: "Car Loan",
        plan: null,
        pattern:
          /Our interest rates range from (?<value>[\d.]+)% to (?<maximum>[\d.]+)%/iu,
      },
    ]
  ),
  rangeSource(
    "stadium-finance",
    "car-loan-rates",
    "https://stadium-finance.co.nz/",
    [
      {
        product: "Car Loan",
        plan: null,
        pattern:
          /actual interest rate charged by Stadium Finance in any particular case will be in a range of (?<value>[\d.]+)% p\.a\. to (?<maximum>[\d.]+)% p\.a\./iu,
      },
    ]
  ),
  ...(["personal-loan-rates", "car-loan-rates"] as const).map((dataset) =>
    rangeSource(
      "first-cu",
      dataset,
      "https://www.firstcreditunion.co.nz/about/rates-and-fees/",
      [
        {
          product: dataset === "car-loan-rates" ? "Car Loan" : "Personal Loan",
          plan: null,
          pattern:
            /Our normal floating rates range from (?<value>[\d.]+)% p\.a variable to a maximum of (?<maximum>[\d.]+)% p\.a variable/iu,
        },
      ]
    )
  ),
  ...(["personal-loan-rates", "car-loan-rates"] as const).map((dataset) =>
    rangeSource("harmoney", dataset, "https://www.harmoney.co.nz/", [
      {
        product:
          dataset === "car-loan-rates" ? "Vehicle Loan" : "Personal Loan",
        plan: "Unsecured",
        pattern:
          /Interest rate from²? (?<value>[\d.]+)% - (?<maximum>[\d.]+)% p\.a\./iu,
      },
    ])
  ),
  rangeSource("mtf-finance", "personal-loan-rates", mtf, [
    { product: "Personal Loan", plan: "Secured", pattern: mtfSecured },
    { product: "Personal Loan", plan: "Unsecured", pattern: mtfUnsecured },
  ]),
  rangeSource("mtf-finance", "car-loan-rates", mtf, [
    { product: "Vehicles loan", plan: "Secured", pattern: mtfSecured },
  ]),
  rangeSource("geneva-finance", "personal-loan-rates", geneva, [
    { product: "Personal Loan", plan: null, pattern: genevaRange },
  ]),
  rangeSource("geneva-finance", "car-loan-rates", geneva, [
    { product: "Vehicle Loan", plan: null, pattern: genevaRange },
  ]),
  rangeSource("instant-finance", "personal-loan-rates", instant, [
    { product: "Personal Loans", plan: null, pattern: instantRange },
  ]),
  rangeSource("instant-finance", "car-loan-rates", instant, [
    { product: "Car Loan", plan: null, pattern: instantRange },
  ]),
  rangeSource("aa-money", "car-loan-rates", aa, [
    {
      product: "Car or Boat Loan",
      plan: "Secured",
      pattern:
        /Our vehicle loan rates range from (?<value>[\d.]+)% p\.a\. to (?<maximum>[\d.]+)% p\.a\./iu,
    },
  ]),
  rangeSource("aa-money", "personal-loan-rates", aa, [
    {
      product: "Personal Loan",
      plan: null,
      pattern:
        /Our personal loan rates range from (?<value>[\d.]+)% p\.a\. to (?<maximum>[\d.]+)% p\.a\./iu,
    },
  ]),
  rangeSource("avanti-finance", "car-loan-rates", avanti, [
    {
      product: "Car Loans",
      plan: "Secured",
      pattern:
        /Auto Loan Interest Rates Secured fixed interest rates between: (?<value>[\d.]+)%\s*–\s*(?<maximum>[\d.]+)%/iu,
    },
  ]),
  rangeSource("avanti-finance", "personal-loan-rates", avanti, [
    {
      product: "Personal Loan",
      plan: "Unsecured",
      pattern:
        /Personal Loan Interest Rates Unsecured fixed interest rates between: (?<value>[\d.]+)%\s*–\s*(?<maximum>[\d.]+)%/iu,
    },
  ]),
  rangeSource(
    "oxford-finance",
    "car-loan-rates",
    "https://www.oxfordfinance.co.nz/fees-and-charges-for-vehicle-and-personal-finance/",
    [
      {
        product: "Vehicle finance",
        plan: "Secured",
        pattern:
          /Our interest rates range between (?<value>[\d.]+)%pa to (?<maximum>[\d.]+)%pa/iu,
      },
    ]
  ),
  rangeSource(
    "nectar",
    "personal-loan-rates",
    "https://nectar.co.nz/rate-and-terms/",
    [
      {
        product: "Personal Loan",
        plan: "Unsecured",
        pattern:
          /competitive personal loan rates with fixed interest rates from (?<value>[\d.]+)% to (?<maximum>[\d.]+)% p\.a\./iu,
      },
    ]
  ),
  rangeSource(
    "pronto-finance",
    "personal-loan-rates",
    "https://www.prontofinance.co.nz/",
    [
      {
        product: "Personal Loan",
        plan: null,
        pattern:
          /Annual Interest Rate \(AIR\)\s*[+−-]*\s*This is set between (?<value>[\d.]+)% and (?<maximum>[\d.]+)% depending on your client rating/iu,
      },
    ]
  ),
  rangeSource(
    "admiral-finance",
    "personal-loan-rates",
    "https://www.admiralfinance.co.nz/interest-rates-fees/",
    [
      {
        product: "Personal Loans",
        plan: "Secured",
        pattern:
          /Loan Type Minimum Rate Maximum Rate Secured Loan (?<value>[\d.]+)% (?<maximum>[\d.]+)%/iu,
      },
    ]
  ),
  {
    id: "heartland-car",
    institution: "heartland-bank",
    dataset: "car-loan-rates",
    urls: ["https://www.heartland.co.nz/car-loans/rates-fees-terms"],
    parse(pages) {
      const url = this.urls[0] ?? "";
      const text = plainText(page(pages, url));
      const range = requiredMatch(
        text,
        /Our interest rates range from (?<value>[\d.]+)% p\.a\. to (?<maximum>[\d.]+)% p\.a\./iu
      );
      const tesla = requiredMatch(
        text,
        /Tesla Loan rates, fees and terms Rates Our interest rates is (?<value>[\d.]+)%\s*p\.a\./iu
      );
      return [
        {
          product: "Car Loan",
          rate: percentage(range[1] ?? ""),
          rateMaximum: percentage(range[2] ?? ""),
          rateType: "range",
          plan: "Secured",
          condition:
            "Fixed for the loan term; rate depends on personal circumstances.",
          sourceUrl: url,
        },
        {
          product: "Tesla Loan",
          rate: percentage(tesla[1] ?? ""),
          plan: "Secured",
          condition: "Tesla loan eligibility criteria apply.",
          sourceUrl: url,
        },
      ];
    },
  },
  {
    id: "avanti-mortgage",
    institution: "avanti-finance",
    dataset: "mortgage-rates",
    urls: [avanti],
    parse(pages) {
      const text = plainText(page(pages, avanti));
      return ["Near Prime", "Specialist"].map((product) => ({
        product,
        termInMonths: null,
        sourceUrl: avanti,
        rate: percentage(
          requiredMatch(
            text,
            new RegExp(
              `First Mortgage Loans \\(${product}\\) Base Variable Rate: ([\\d.]+)%`,
              "iu"
            )
          )[1] ?? ""
        ),
        condition:
          "Base variable rate. High LVRs above 80% may have a margin of up to 1% applied.",
      }));
    },
  },
];
