import { createHttpClient } from "./http-client";

export type InterestScraperAPI = {
  getCarLoanRatesPage(): Promise<string | undefined>;
  getCreditCardRatesPage(): Promise<string | undefined>;
  getMortgageRatesPage(): Promise<string | undefined>;
  getPersonalLoanRatesPage(): Promise<string | undefined>;
};

export function InterestScraperAPI(): InterestScraperAPI {
  const httpClient = createHttpClient("InterestScraperAPI", {
    headers: {
      "User-Agent":
        "ratesapi.nz scraper (+https://ratesapi.nz; contact: ops@ratesapi.nz)",
    },
    prefixUrl: "https://www.interest.co.nz/",
    retryOptions: {
      retries: 3,
      retryDelay: 1500,
      retryOn: [408, 429, 500, 502, 503, 504],
    },
    timeoutMs: 20000,
  });

  async function getCarLoanRatesPage(): Promise<string | undefined> {
    const response = await httpClient("borrowing/car-loan");
    return response.text();
  }

  async function getCreditCardRatesPage(): Promise<string | undefined> {
    const response = await httpClient("borrowing/credit-cards");
    return response.text();
  }

  async function getMortgageRatesPage(): Promise<string | undefined> {
    const response = await httpClient("borrowing");
    return response.text();
  }

  async function getPersonalLoanRatesPage(): Promise<string | undefined> {
    const response = await httpClient("borrowing/personal-loan");
    return response.text();
  }

  return {
    getCarLoanRatesPage,
    getCreditCardRatesPage,
    getMortgageRatesPage,
    getPersonalLoanRatesPage,
  };
}
