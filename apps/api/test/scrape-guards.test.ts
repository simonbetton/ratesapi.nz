import { describe, expect, test } from "bun:test";

import { assertScrapeHasRates, assertTableHasRows } from "../bin/scrape-guards";
import type { CarLoanRates } from "../src/models/car-loan-rates";
import type { CreditCardRates } from "../src/models/credit-card-rates";
import type { MortgageRates } from "../src/models/mortgage-rates";
import type { PersonalLoanRates } from "../src/models/personal-loan-rates";

function minimalMortgage(): MortgageRates {
  return {
    type: "MortgageRates",
    data: [
      {
        id: "institution:anz",
        name: "ANZ",
        products: [
          {
            id: "product:anz:standard",
            name: "Standard",
            rates: [
              {
                id: "rate:anz:standard:1-year",
                term: "1 year",
                termInMonths: 12,
                rate: 6.99,
              },
            ],
          },
        ],
      },
    ],
    lastUpdated: "2026-01-01T00:00:00.000Z",
  };
}

function minimalPersonalLoan(): PersonalLoanRates {
  return {
    type: "PersonalLoanRates",
    data: [
      {
        id: "institution:asb",
        name: "ASB",
        products: [
          {
            id: "product:asb:personal-loan",
            name: "Personal Loan",
            rates: [
              {
                id: "rate:asb:personal-loan:secured",
                plan: "Secured",
                condition: "$3,000 to $50,000",
                rate: 12.95,
              },
            ],
          },
        ],
      },
    ],
    lastUpdated: "2026-01-01T00:00:00.000Z",
  };
}

function minimalCarLoan(): CarLoanRates {
  return {
    type: "CarLoanRates",
    data: [
      {
        id: "institution:asb",
        name: "ASB",
        products: [
          {
            id: "product:asb:car-loan",
            name: "Car Loan",
            rates: [
              {
                id: "rate:asb:car-loan:secured",
                plan: "Secured",
                condition: "$3,000 to $50,000",
                rate: 9.95,
              },
            ],
          },
        ],
      },
    ],
    lastUpdated: "2026-01-01T00:00:00.000Z",
  };
}

function minimalCreditCard(): CreditCardRates {
  return {
    type: "CreditCardRates",
    data: [
      {
        id: "issuer:amex",
        name: "Amex",
        plans: [
          {
            id: "plan:amex:airpoints",
            name: "Airpoints",
            interestFreePeriodInMonths: 55,
            primaryFeeNZD: 149,
            balanceTransferRate: 0,
            balanceTransferPeriod: null,
            cashAdvanceRate: 21.95,
            purchaseRate: 21.95,
          },
        ],
      },
    ],
    lastUpdated: "2026-01-01T00:00:00.000Z",
  };
}

describe("assertScrapeHasRates", () => {
  test("does not throw for a minimal valid model from each family", () => {
    expect(() => assertScrapeHasRates(minimalMortgage())).not.toThrow();
    expect(() => assertScrapeHasRates(minimalPersonalLoan())).not.toThrow();
    expect(() => assertScrapeHasRates(minimalCarLoan())).not.toThrow();
    expect(() => assertScrapeHasRates(minimalCreditCard())).not.toThrow();
  });

  test("throws when the top-level data array is empty, for every family", () => {
    const emptyMortgage: MortgageRates = { ...minimalMortgage(), data: [] };
    const emptyPersonalLoan: PersonalLoanRates = {
      ...minimalPersonalLoan(),
      data: [],
    };
    const emptyCarLoan: CarLoanRates = { ...minimalCarLoan(), data: [] };
    const emptyCreditCard: CreditCardRates = {
      ...minimalCreditCard(),
      data: [],
    };

    expect(() => assertScrapeHasRates(emptyMortgage)).toThrow(
      /scrape returned no data/u
    );
    expect(() => assertScrapeHasRates(emptyPersonalLoan)).toThrow(
      /scrape returned no data/u
    );
    expect(() => assertScrapeHasRates(emptyCarLoan)).toThrow(
      /scrape returned no data/u
    );
    expect(() => assertScrapeHasRates(emptyCreditCard)).toThrow(
      /scrape returned no data/u
    );
  });

  test("throws when a mortgage institution has no products", () => {
    const base = minimalMortgage();
    const model: MortgageRates = {
      ...base,
      data: [{ id: "institution:anz", name: "ANZ", products: [] }],
    };

    expect(() => assertScrapeHasRates(model)).toThrow(
      /no institution has any products/u
    );
  });

  test("throws when a personal loan institution has no products", () => {
    const base = minimalPersonalLoan();
    const model: PersonalLoanRates = {
      ...base,
      data: [{ id: "institution:asb", name: "ASB", products: [] }],
    };

    expect(() => assertScrapeHasRates(model)).toThrow(
      /no institution has any products/u
    );
  });

  test("throws when a car loan institution has no products", () => {
    const base = minimalCarLoan();
    const model: CarLoanRates = {
      ...base,
      data: [{ id: "institution:asb", name: "ASB", products: [] }],
    };

    expect(() => assertScrapeHasRates(model)).toThrow(
      /no institution has any products/u
    );
  });

  test("throws when a mortgage product has no rates", () => {
    const model: MortgageRates = {
      ...minimalMortgage(),
      data: [
        {
          id: "institution:anz",
          name: "ANZ",
          products: [
            { id: "product:anz:standard", name: "Standard", rates: [] },
          ],
        },
      ],
    };

    expect(() => assertScrapeHasRates(model)).toThrow(
      /no product has any rates/u
    );
  });

  test("throws when a personal loan product has no rates", () => {
    const model: PersonalLoanRates = {
      ...minimalPersonalLoan(),
      data: [
        {
          id: "institution:asb",
          name: "ASB",
          products: [
            {
              id: "product:asb:personal-loan",
              name: "Personal Loan",
              rates: [],
            },
          ],
        },
      ],
    };

    expect(() => assertScrapeHasRates(model)).toThrow(
      /no product has any rates/u
    );
  });

  test("throws when a car loan product has no rates", () => {
    const model: CarLoanRates = {
      ...minimalCarLoan(),
      data: [
        {
          id: "institution:asb",
          name: "ASB",
          products: [
            { id: "product:asb:car-loan", name: "Car Loan", rates: [] },
          ],
        },
      ],
    };

    expect(() => assertScrapeHasRates(model)).toThrow(
      /no product has any rates/u
    );
  });

  test("throws when a credit card issuer has no plans", () => {
    const model: CreditCardRates = {
      ...minimalCreditCard(),
      data: [{ id: "issuer:amex", name: "Amex", plans: [] }],
    };

    expect(() => assertScrapeHasRates(model)).toThrow(
      /no issuer has any plans/u
    );
  });

  test("stays valid when one product has no rates but another product in the snapshot does", () => {
    const model: MortgageRates = {
      ...minimalMortgage(),
      data: [
        {
          id: "institution:anz",
          name: "ANZ",
          products: [
            {
              id: "product:anz:standard",
              name: "Standard",
              rates: [
                {
                  id: "rate:anz:standard:1-year",
                  term: "1 year",
                  termInMonths: 12,
                  rate: 6.99,
                },
              ],
            },
            { id: "product:anz:empty", name: "Empty", rates: [] },
          ],
        },
      ],
    };

    expect(() => assertScrapeHasRates(model)).not.toThrow();
  });

  test("stays valid when one institution has no products but another institution does", () => {
    const model: MortgageRates = {
      ...minimalMortgage(),
      data: [
        ...minimalMortgage().data,
        { id: "institution:kiwibank", name: "Kiwibank", products: [] },
      ],
    };

    expect(() => assertScrapeHasRates(model)).not.toThrow();
  });
});

describe("assertTableHasRows", () => {
  test("does not throw when there is at least one row", () => {
    expect(() =>
      assertTableHasRows(1, "#interest_financial_datatable tbody tr")
    ).not.toThrow();
  });

  test("throws when there are no rows", () => {
    expect(() =>
      assertTableHasRows(0, "#interest_financial_datatable tbody tr")
    ).toThrow(/No rows found for selector/u);
  });
});
