import { requestUrl } from "./api-examples";

export type RequestResult =
  | { status: "success"; body: string }
  | { status: "error"; message: string };

export async function fetchMortgageRates(term: string): Promise<RequestResult> {
  try {
    const response = await fetch(requestUrl(term), {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return {
        status: "error",
        message: `The API returned HTTP ${response.status}. Try again or check service health.`,
      };
    }
    const body: unknown = await response.json();
    return { status: "success", body: JSON.stringify(body, null, 2) };
  } catch {
    return {
      status: "error",
      message:
        "Could not load the API response. Check your connection and retry, or open the endpoint directly.",
    };
  }
}
