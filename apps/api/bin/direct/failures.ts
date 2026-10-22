/** Only transport boundaries may classify a source as temporarily unavailable. */
export class SourceUnavailableError extends Error {
  override name = "SourceUnavailableError";
}

export function unavailableHttpStatus(status: number): boolean {
  return [403, 408, 429].includes(status) || status >= 500;
}
