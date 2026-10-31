/** Only transport boundaries may classify a source as temporarily unavailable. */
export class SourceUnavailableError extends Error {
  override name = "SourceUnavailableError";

  /** Whether an immediate retry with a fresh browser session can help. */
  readonly retryable: boolean;

  constructor(
    message: string,
    options: ErrorOptions & { retryable?: boolean } = {}
  ) {
    super(message, options);
    this.retryable = options.retryable ?? true;
  }
}

export function unavailableHttpStatus(status: number): boolean {
  return [403, 408, 429].includes(status) || status >= 500;
}
