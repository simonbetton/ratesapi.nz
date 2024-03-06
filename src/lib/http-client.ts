import { createLogger } from "./logging";

type RetryOptions = {
  retries: number;
  retryDelay: number;
  retryOn: Array<number>;
};

type FetchOptions = RequestInit & {
  retryOptions?: RetryOptions;
};

type DefaultFetchOptions = FetchOptions & {
  prefixUrl?: string;
};

export function createHttpClient(
  name: string,
  defaultOptions?: DefaultFetchOptions,
) {
  const log = createLogger(name);

  const fetchWithRetry = async (
    url: string,
    requestOptions: FetchOptions = {},
  ): Promise<Response> => {
    const composedUrl = defaultOptions?.prefixUrl
      ? new URL(url, defaultOptions.prefixUrl).toString()
      : url;

    // Merge default and request-specific options, with request options taking precedence
    const mergedOptions: FetchOptions = {
      ...defaultOptions,
      ...requestOptions,
    };
    const { retryOptions } = mergedOptions;
    let retries = retryOptions?.retries ?? 0;
    const retryDelay = retryOptions?.retryDelay ?? 0;
    const retryOn = retryOptions?.retryOn ?? [];

    const executeFetch = async (): Promise<Response> => {
      try {
        const response = await fetch(composedUrl, mergedOptions);

        // Log the request
        log.debug(
          {
            url: composedUrl,
            headers: mergedOptions.headers,
            method: mergedOptions.method,
          },
          `${name}: ${mergedOptions.method ?? "GET"} ${composedUrl}`,
        );

        if (response.ok) {
          return response;
        }

        if (retryOn.includes(response.status) && retries > 0) {
          log.info(`${name}: Retrying after status code: ${response.status}`);
          retries -= 1;
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return executeFetch();
        }

        throw new Error(`Request failed with status ${response.status}`);
      } catch (error) {
        if (retries > 0) {
          log.info(`${name}: Retrying due to error: ${error}`);
          retries -= 1;
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return executeFetch();
        }

        throw error;
      }
    };

    return executeFetch();
  };

  return fetchWithRetry;
}
