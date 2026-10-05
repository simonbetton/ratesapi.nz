import { documentLink, pdfText } from "./documents";
import { percentage, requireCount, requiredMatch } from "./parsing";
import type { DirectSource, Observation } from "./types";

const base = "https://www.basecorp.co.nz/home-loans/";
const liberty = "https://www.libfin.co.nz/home-loans";
const cfml = "https://www.conradfundsmanagement.co.nz/borrowers/";
const xceda =
  "https://www.xceda.co.nz/important-information/lending-interest-rates-fees-and-standard-terms";
const baseDocument = /Statement.*Costs.*Interest/iu;
const libertyDocument = /nz-liberty-consumer-interest-rates\.pdf/iu;
const xcedaDocument = /Lending(?:%20| )Rates.*CCCFA.*\.pdf/iu;
const cfmlProducts = [
  { product: "Prime 80", document: /CFML-Prime-80-.*Rates\.pdf/iu },
  { product: "321 Loan", document: /CFML-321-.*Rates\.pdf/iu },
  { product: "Prime", document: /CFML-Prime-(?!80).*Rates\.pdf/iu },
  { product: "Standard", document: /CFML-Standard-.*Rates\.pdf/iu },
  { product: "Specialist", document: /CFML-Specialist-.*Rates\.pdf/iu },
  { product: "Investor 10", document: /CFML-Investor-10-.*Rates\.pdf/iu },
];

function range(
  match: RegExpExecArray
): Pick<Observation, "rate" | "rateMaximum" | "rateType"> {
  return {
    rate: percentage(match[1] ?? ""),
    rateMaximum: percentage(match[2] ?? ""),
    rateType: "range",
  };
}

export const pdfSources: DirectSource[] = [
  {
    id: "basecorp-mortgage",
    institution: "basecorp-finance",
    dataset: "mortgage-rates",
    urls: [base],
    discover: (pages) => [documentLink(pages, base, baseDocument)],
    parse(pages) {
      const sourceUrl = documentLink(pages, base, baseDocument);
      const text = pdfText(pages, sourceUrl);
      return [
        [
          "Short Term Mortgage Finance",
          /Short Term Mortgage Finance (?<rate>[\d.]+)%\s*-\s*(?<maximum>[\d.]+)%/u,
        ],
        [
          "Long Term Mortgage Finance — Housing",
          /Housing\s*[–-]\s*(?<rate>[\d.]+)%\s*-\s*(?<maximum>[\d.]+)%/u,
        ],
        [
          "Long Term Mortgage Finance — Land",
          /Land\s*[–-]\s*(?<rate>[\d.]+)%\s*to\s*(?<maximum>[\d.]+)%/u,
        ],
      ].map(([product, pattern]) => ({
        product: String(product),
        ...range(requiredMatch(text, pattern as RegExp)),
        termInMonths: null,
        term: "By agreement",
        sourceUrl,
        condition:
          "Consumer loan rates depend on the individual application, security, LVR and credit history. Fees apply.",
      }));
    },
  },
  {
    id: "liberty-mortgage",
    institution: "liberty-financial",
    dataset: "mortgage-rates",
    urls: [liberty],
    documentOrigins: ["https://a.storyblok.com"],
    discover: (pages) => [documentLink(pages, liberty, libertyDocument)],
    parse(pages) {
      const sourceUrl = documentLink(pages, liberty, libertyDocument);
      const text = pdfText(pages, sourceUrl);
      const rows = requireCount(
        [
          ...text.matchAll(
            /≤(?<lvr>70|75|80)% (?<variable>[\d.]+)% (?<one>[\d.]+)% (?<two>[\d.]+)% (?<three>[\d.]+)%/gu
          ),
        ],
        3
      );
      const rates: Observation[] = rows.flatMap((row) =>
        [null, 12, 24, 36].map((termInMonths, index) => ({
          product: `Prime Residential ≤${row[1]}% LVR`,
          rate: percentage(row[index + 2] ?? ""),
          termInMonths,
          sourceUrl,
          condition:
            "New loan rates; subject to credit assessment. Interest-only and vacant-land loadings and fees may apply.",
        }))
      );
      rates.push({
        product: "Boost Residential",
        rate: percentage(
          requiredMatch(
            text,
            /variable interest rate for new and existing Boost loans is (?<rate>[\d.]+)%/u
          )[1] ?? ""
        ),
        termInMonths: null,
        sourceUrl,
        condition:
          "Additional Boost portion of higher-LVR lending; principal and interest, maximum seven-year loan term.",
      });
      for (const [product, pattern] of [
        [
          "Custom Star (Full Documentation)",
          /Star \(Full Documentation\) loans is in the range of (?<rate>[\d.]+)% p\.a\. – (?<maximum>[\d.]+)% p\.a\. for new loans/u,
        ],
        [
          "Custom Nova (Low Documentation)",
          /Nova \(Low Documentation\) loans is in the range of (?<rate>[\d.]+)% p\.a\. – (?<maximum>[\d.]+)% p\.a\. for new loans/u,
        ],
      ] as const) {
        rates.push({
          product,
          ...range(requiredMatch(text, pattern)),
          termInMonths: null,
          sourceUrl,
          condition:
            "New loan variable rate depends on credit profile; fees apply.",
        });
      }
      return rates;
    },
  },
  {
    id: "cfml-mortgage",
    institution: "cfml-loans",
    dataset: "mortgage-rates",
    urls: [cfml],
    discover: (pages) =>
      cfmlProducts.map(({ document }) => documentLink(pages, cfml, document)),
    parse(pages) {
      return cfmlProducts.map(({ product, document }) => {
        const sourceUrl = documentLink(pages, cfml, document);
        const text = pdfText(pages, sourceUrl);
        const match = requiredMatch(
          text,
          product === "321 Loan"
            ? /headline interest rate is (?<rate>[\d.]+)%/u
            : /Interest Rate (?<rate>[\d.]+)% p\.a\./u
        );
        const [, lvr] = requiredMatch(
          text,
          /LVR Limit (?<lvr>.+?) Fixed or Floating/u
        );
        const [, score] = requiredMatch(
          text,
          /Credit Score\*+ >(?<score>\d+)/u
        );
        return {
          product,
          rate: percentage(match[1] ?? ""),
          termInMonths: null,
          sourceUrl,
          condition: `Floating rate. LVR limit ${lvr}; credit score above ${score}; fees and lending criteria apply.${product === "321 Loan" ? " Headline contractual rate; purchasing mortgage points can reduce payments during the first three years. Non-CCCFA only." : ""}${product === "Investor 10" ? " Non-CCCFA investor loan; interest-only for ten years." : ""}`,
        };
      });
    },
  },
  {
    id: "xceda-mortgage",
    institution: "xceda-finance",
    dataset: "mortgage-rates",
    urls: [xceda],
    discover: (pages) => [documentLink(pages, xceda, xcedaDocument)],
    parse(pages) {
      const sourceUrl = documentLink(pages, xceda, xcedaDocument);
      const text = pdfText(pages, sourceUrl);
      const match = requiredMatch(
        text,
        /Rates \(Fixed From\)(?<bridgeMin>[\d.]+)% - (?<bridgeMax>[\d.]+)% p\.a\.\*(?<landMin>[\d.]+)% - (?<landMax>[\d.]+)% p\.a\.\*/u
      );
      if (!/Term3-18 months3 - 18 months/u.test(text)) {
        throw new Error("Xceda fixed-term range changed; review product terms");
      }
      return ["Short term bridging", "Vacant Land"].map((product, index) => ({
        product,
        rate: percentage(match[index * 2 + 1] ?? ""),
        rateMaximum: percentage(match[index * 2 + 2] ?? ""),
        rateType: "range",
        termInMonths: null,
        term: "Fixed for 3–18 months",
        sourceUrl,
        condition:
          "Consumer first mortgage; fixed rate depends on credit profile, selected term and security. LVR limits and fees apply.",
      }));
    },
  },
];
