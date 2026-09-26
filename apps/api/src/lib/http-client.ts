import { setTimeout as sleep } from "node:timers/promises";

import { createLogger } from "./logging";

export interface RetryOptions {
  retries: number;
  retryDelay: number;
  retryOn: number[];
}

export type FetchOptions = RequestInit & {
  retryOptions?: RetryOptions;
  /**
   * Aborts each attempt after this many milliseconds, so a server that
   * hangs gives an error. The limit also applies when the caller reads the
   * response body.
   */
  timeoutMs?: number;
};

export type DefaultFetchOptions = FetchOptions & {
  prefixUrl?: string;
};

export function createHttpClient(
  name: string,
  defaultOptions?: DefaultFetchOptions
) {
  const log = createLogger(name);

  const fetchWithRetry = async (
    url: string,
    requestOptions: FetchOptions = {}
  ): Promise<Response> => {
    const composedUrl = defaultOptions?.prefixUrl
      ? new URL(url, defaultOptions.prefixUrl).toString()
      : url;

    // Merge default and request-specific options, with request options taking precedence
    const mergedOptions: FetchOptions = {
      ...defaultOptions,
      ...requestOptions,
    };
    const { retryOptions, timeoutMs } = mergedOptions;
    let retries = retryOptions?.retries ?? 0;
    const retryDelay = retryOptions?.retryDelay ?? 0;
    const retryOn = retryOptions?.retryOn ?? [];

    const executeFetch = async (): Promise<Response> => {
      try {
        const response = await fetch(
          composedUrl,
          timeoutMs === undefined
            ? mergedOptions
            : {
                ...mergedOptions,
                signal: withTimeout(mergedOptions, timeoutMs),
              }
        );

        // Log the request
        log.debug(
          {
            url: composedUrl,
            headers: mergedOptions.headers,
            method: mergedOptions.method,
          },
          `${name}: ${mergedOptions.method ?? "GET"} ${composedUrl}`
        );

        if (response.ok) {
          return response;
        }

        if (retryOn.includes(response.status) && retries > 0) {
          log.info(`${name}: Retrying after status code: ${response.status}`);
          retries -= 1;
          await sleep(retryDelay);
          return executeFetch();
        }

        throw new Error(`Request failed with status ${response.status}`);
      } catch (error) {
        if (retries > 0) {
          log.info(`${name}: Retrying due to error: ${error}`);
          retries -= 1;
          await sleep(retryDelay);
          return executeFetch();
        }

        throw error;
      }
    };

    return await executeFetch();
  };

  return fetchWithRetry;
}

function withTimeout(options: RequestInit, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);

  return options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
}
