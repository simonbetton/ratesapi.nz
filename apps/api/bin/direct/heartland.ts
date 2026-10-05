import { page, percentage, plainText, requiredMatch } from "./parsing";
import type { DirectSource } from "./types";

const home = "https://www.heartland.co.nz/home-loans";
const reverse = "https://www.heartland.co.nz/reverse-mortgage/interest-rates";
const village = "https://www.heartland.co.nz/village-access-loans/rates-fees";
const personal = "https://www.heartland.co.nz/personal-loans/rates-fees-terms";
const youChoose =
  "https://www.heartland.co.nz/savings-and-deposits/youchoose/pricing";

export const heartlandSources: DirectSource[] = [
  {
    id: "heartland-mortgage",
    institution: "heartland-bank",
    dataset: "mortgage-rates",
    urls: [home, reverse, village],
    parse(pages) {
      const homeText = plainText(page(pages, home));
      const floating = requiredMatch(
        homeText,
        /Floating (?<value>[\d.]+)\s*% p\.a\. Revolving credit - floating \(charged monthly\) (?<maximum>[\d.]+)\s*% p\.a\./u
      );
      return [
        {
          product: "Residential",
          termInMonths: null,
          rate: percentage(floating[1] ?? ""),
          sourceUrl: home,
          condition:
            "Existing customers only; closed to new home loan customers and top-ups.",
        },
        {
          product: "Revolving Credit",
          termInMonths: null,
          rate: percentage(floating[2] ?? ""),
          sourceUrl: home,
          condition: "Existing customers only.",
        },
        {
          product: "Reverse Mortgage",
          termInMonths: null,
          rate: percentage(
            requiredMatch(
              plainText(page(pages, reverse)),
              /Heartland Reverse Mortgage’s variable interest rate is (?<value>[\d.]+)% per annum/u
            )[1] ?? ""
          ),
          sourceUrl: reverse,
          condition:
            "Reverse mortgage eligibility criteria apply; legacy loans can have different rates.",
        },
        {
          product: "Village Access loan",
          termInMonths: null,
          rate: percentage(
            requiredMatch(
              plainText(page(pages, village)),
              /Heartland Village Access Loan’s variable interest rate is (?<value>[\d.]+)% per annum/u
            )[1] ?? ""
          ),
          sourceUrl: village,
          condition: "Village Access loan eligibility criteria apply.",
        },
      ];
    },
  },
  {
    id: "heartland-personal",
    institution: "heartland-bank",
    dataset: "personal-loan-rates",
    urls: [personal, youChoose],
    parse(pages) {
      const match = requiredMatch(
        plainText(page(pages, personal)),
        /Interest rates range from (?<value>[\d.]+)% p\.a\. to (?<maximum>[\d.]+)% p\.a\./u
      );
      return [
        {
          product: "YouChoose Overdraft",
          plan: "Overdraft",
          rate: percentage(
            requiredMatch(
              plainText(page(pages, youChoose)),
              /Overdraft interest rate (?<rate>[\d.]+)% p\.a\./u
            )[1] ?? ""
          ),
          sourceUrl: youChoose,
          condition:
            "Floating rate for an agreed YouChoose overdraft; excess interest can apply above the limit.",
        },
        {
          product: "Personal Loan",
          plan: "Unsecured",
          rate: percentage(match[1] ?? ""),
          rateMaximum: percentage(match[2] ?? ""),
          rateType: "range",
          sourceUrl: personal,
          condition:
            "Existing customers only; no new unsecured personal loan applications.",
        },
      ];
    },
  },
];
