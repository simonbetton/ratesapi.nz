import { chromium } from "playwright";
import type {
  Browser,
  BrowserContext,
  Page,
  Response as BrowserResponse,
} from "playwright";

import { createSourceFetcher } from "./collect";
import type { FetchPage } from "./collect";
import type { BrowserReadiness, DirectSource } from "./types";

export type BrowserMode = "auto" | "local" | "cloud";
/* oxlint-disable promise/prefer-await-to-then -- Queue chaining must keep independent source tasks ordered. */
/* oxlint-disable preserve-caught-error -- Raw browser errors can contain secret CDP connection URLs. */
type HttpFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface BrowserSession {
  browser: Browser;
  close: () => Promise<void>;
}

interface BrowserDependencies {
  fetch: HttpFetch;
  launch: () => Promise<Browser>;
  connect: (url: string) => Promise<Browser>;
}

const defaultDependencies: BrowserDependencies = {
  fetch,
  launch: () => chromium.launch({ headless: true }),
  connect: (url) => chromium.connectOverCDP(url, { timeout: 30_000 }),
};

const browserApi = "https://api.browser-use.com/api/v4/browsers";

class RetryableBrowserError extends Error {
  override name = "RetryableBrowserError";
}

type BrowserPhase =
  | "context setup"
  | "navigation"
  | "rate feed"
  | "rate hydration";

function browserFailure(error: unknown, phase: BrowserPhase): Error {
  if (error instanceof RetryableBrowserError) {
    return error;
  }
  if (error instanceof Error && phase === "navigation") {
    // Only expose a known error code, never the raw CDP/browser call log.
    const networkCode =
      /\bnet::(?<code>ERR_(?:TUNNEL_CONNECTION_FAILED|PROXY_CONNECTION_FAILED|CONNECTION_RESET|CONNECTION_CLOSED|CONNECTION_TIMED_OUT|NETWORK_CHANGED|TIMED_OUT))\b/u.exec(
        error.message
      )?.groups?.code;
    if (networkCode || error.name === "TimeoutError") {
      return new RetryableBrowserError(
        `Browser navigation failed (${networkCode ?? "TimeoutError"})`
      );
    }
  }
  if (
    error instanceof Error &&
    /^(?:Browser page returned HTTP|Required first-party|Browser source redirected)/u.test(
      error.message
    )
  ) {
    return error;
  }
  return new Error(
    `Browser navigation or rate hydration failed during ${phase}`
  );
}

/** Never propagate browser/API errors that may contain a credential-bearing CDP URL. */
export async function openBrowserSession(
  host: "local" | "cloud",
  apiKey?: string,
  deps: BrowserDependencies = defaultDependencies,
  proxyCountryCode: "nz" | "au" = "nz"
): Promise<BrowserSession> {
  if (host === "local") {
    try {
      const browser = await deps.launch();
      return { browser, close: () => browser.close() };
    } catch {
      throw new Error(
        "Local Chromium launch failed; run bunx playwright install chromium"
      );
    }
  }
  if (process.versions.bun && deps === defaultDependencies) {
    throw new Error(
      "Cloud browser connections require Node.js; use bun run sources:browser or bun run scrape"
    );
  }
  if (!apiKey) {
    throw new Error("Cloud browser requires BROWSER_USE_API_KEY");
  }
  const headers = {
    "X-Browser-Use-API-Key": apiKey,
    "Content-Type": "application/json",
  };
  let response: Response;
  try {
    response = await deps.fetch(browserApi, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        proxyCountryCode,
        timeout: 15,
        enableRecording: false,
      }),
    });
  } catch {
    throw new Error("Browser Use session creation failed or timed out");
  }
  if (!response.ok) {
    throw new Error(
      `Browser Use session creation returned HTTP ${response.status}`
    );
  }
  const data: unknown = await response.json().catch(() => null);
  if (
    !data ||
    typeof data !== "object" ||
    !("id" in data) ||
    typeof data.id !== "string" ||
    !/^[\da-f-]{36}$/iu.test(data.id)
  ) {
    throw new Error("Browser Use returned an invalid session ID");
  }
  const sessionUrl = `${browserApi}/${data.id}`;
  const stop = async () => {
    try {
      const stopped = await deps.fetch(sessionUrl, {
        method: "PATCH",
        headers,
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({ action: "stop" }),
      });
      if (!stopped.ok) {
        throw new Error("stop failed");
      }
    } catch {
      throw new Error(
        "Browser Use session stop failed; session has a 15-minute expiry"
      );
    }
  };
  let browser: Browser;
  try {
    if (
      !("cdpUrl" in data) ||
      typeof data.cdpUrl !== "string" ||
      !["https:", "wss:"].includes(new URL(data.cdpUrl).protocol)
    ) {
      throw new Error("Invalid CDP URL");
    }
    browser = await deps.connect(data.cdpUrl);
  } catch {
    await stop();
    throw new RetryableBrowserError("Browser Use CDP connection failed");
  }
  return {
    browser,
    async close() {
      try {
        await browser.close();
      } catch {
        throw new Error("Browser Use disconnect failed");
      } finally {
        // Disconnecting Playwright does not stop a v4 cloud session or its billing.
        await stop();
      }
    },
  };
}

export interface BrowserAttempt {
  url: string;
  host: "local" | "cloud";
  status: "ok" | "failed";
  error?: string;
  proxyCountryCode?: "nz" | "au";
}

export function browserMode(
  value = process.env.RATES_BROWSER ?? "auto"
): BrowserMode {
  if (value !== "auto" && value !== "local" && value !== "cloud") {
    throw new Error("RATES_BROWSER must be auto, local, or cloud");
  }
  return value;
}

/** One browser page at a time; no competing pages or cookie state between institutions. */
export function createCollectionTransport(
  sources: readonly DirectSource[],
  options: {
    mode?: BrowserMode;
    apiKey?: string;
    http?: FetchPage;
    open?: typeof openBrowserSession;
  } = {}
): {
  fetchPage: FetchPage;
  close: () => Promise<void>;
  attempts: BrowserAttempt[];
} {
  const mode = options.mode ?? browserMode();
  const apiKey = options.apiKey ?? process.env.BROWSER_USE_API_KEY;
  if (mode === "cloud" && !apiKey) {
    throw new Error("RATES_BROWSER=cloud requires BROWSER_USE_API_KEY");
  }
  const specs = new Map<string, BrowserReadiness>();
  for (const source of sources) {
    for (const [url, spec] of Object.entries(source.browser ?? {})) {
      if (!source.urls.includes(url)) {
        throw new Error(`Browser URL is not declared by ${source.id}`);
      }
      const previous = specs.get(url);
      if (previous && JSON.stringify(previous) !== JSON.stringify(spec)) {
        throw new Error(`Conflicting browser readiness for ${url}`);
      }
      specs.set(url, spec);
    }
  }
  const http = options.http ?? createSourceFetcher();
  const open = options.open ?? openBrowserSession;
  const sessions = new Map<"local" | "cloud", Promise<BrowserSession>>();
  const cache = new Map<string, Promise<string>>();
  const attempts: BrowserAttempt[] = [];
  let cloudProxyCountry: "nz" | "au" = "nz";
  let queue: Promise<unknown> = Promise.resolve();

  async function render(
    url: string,
    spec: BrowserReadiness,
    host: "local" | "cloud"
  ) {
    try {
      let session = sessions.get(host);
      if (!session) {
        session = open(host, apiKey, undefined, cloudProxyCountry);
        sessions.set(host, session);
      }
      const connected = await session;
      const html = await renderPage(connected.browser, url, {
        ...spec,
        cloudChallenge: host === "cloud" && spec.cloudChallenge,
      });
      attempts.push({
        url,
        host,
        status: "ok",
        ...(host === "cloud" ? { proxyCountryCode: cloudProxyCountry } : {}),
      });
      return html;
    } catch (error) {
      // renderPage only emits controlled errors, never raw Playwright call logs.
      const message =
        error instanceof Error ? error.message : "Browser collection failed";
      attempts.push({
        url,
        host,
        status: "failed",
        error: message,
        ...(host === "cloud" ? { proxyCountryCode: cloudProxyCountry } : {}),
      });
      throw error;
    }
  }

  async function renderCloud(url: string, spec: BrowserReadiness) {
    try {
      return await render(url, spec, "cloud");
    } catch (error) {
      if (!(error instanceof RetryableBrowserError)) {
        throw error;
      }
      // A dead proxy tunnel needs a new session, not another page on the same proxy.
      // Stop the old billable session before opening one bounded retry.
      const previous = await sessions.get("cloud")?.catch(() => null);
      await previous?.close();
      sessions.delete("cloud");
      cloudProxyCountry = "au";
      return render(url, spec, "cloud");
    }
  }

  async function collect(url: string, spec: BrowserReadiness) {
    if (mode === "cloud") {
      return renderCloud(url, spec);
    }
    try {
      return await render(url, spec, "local");
    } catch (error) {
      if (mode !== "auto" || !apiKey) {
        throw error;
      }
      return renderCloud(url, spec);
    }
  }

  return {
    attempts,
    fetchPage(url, discoveredReadiness) {
      const spec = discoveredReadiness ?? specs.get(url);
      if (!spec) {
        return http(url);
      }
      let request = cache.get(url);
      if (!request) {
        request = queue.then(() => collect(url, spec));
        queue = request.catch(() => null);
        cache.set(url, request);
      }
      return request;
    },
    async close() {
      await queue;
      const results = await Promise.allSettled(
        [...sessions.values()].map(async (pending) => {
          const session = await pending.catch(() => null);
          await session?.close();
        })
      );
      if (results.some((result) => result.status === "rejected")) {
        throw new Error(
          "Browser cleanup failed; cloud sessions expire after 15 minutes"
        );
      }
    },
  };
}

export async function renderPage(
  browser: Browser,
  url: string,
  spec: BrowserReadiness,
  timeoutMs = 45_000
): Promise<string> {
  const origin = new URL(url);
  if (
    origin.protocol !== "https:" ||
    origin.hostname === "interest.co.nz" ||
    origin.hostname.endsWith(".interest.co.nz")
  ) {
    throw new Error("Browser source must be a first-party HTTPS URL");
  }
  if (
    spec.responseType !== "json" &&
    spec.responseType !== "links" &&
    (!Number.isInteger(spec.minimumRates) || spec.minimumRates < 1)
  ) {
    throw new Error("Browser readiness must require at least one rate");
  }
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let ownsContext = true;
  let phase: BrowserPhase = "context setup";
  try {
    const existing = spec.cloudChallenge ? browser.contexts()[0] : undefined;
    ownsContext = !existing;
    context = existing ?? (await browser.newContext({ locale: "en-NZ" }));
    const currentPage = await context.newPage();
    page = currentPage;
    // Reject cross-origin main-frame redirects before fetching a replacement source.
    await page.route("**/*", (route) => {
      const request = route.request();
      if (
        request.isNavigationRequest() &&
        request.frame() === currentPage.mainFrame() &&
        new URL(request.url()).origin !== origin.origin
      ) {
        return route.abort();
      }
      if (/(?:^|\.)interest\.co\.nz$/u.test(new URL(request.url()).hostname)) {
        return route.abort();
      }
      return route.fallback();
    });
    const required = (spec.requiredResponses ?? []).map((feed) =>
      currentPage
        .waitForResponse(
          (response) => response.url() === feed && response.ok(),
          { timeout: timeoutMs }
        )
        .then(
          () => true,
          () => false
        )
    );
    phase = "navigation";
    const response = await navigateToRates(
      page,
      url,
      spec.cloudChallenge ?? false,
      timeoutMs
    );
    phase = "rate feed";
    const feedResults = await Promise.all(required);
    if (feedResults.some((succeeded) => !succeeded)) {
      throw new Error("Required first-party rate feed did not succeed");
    }
    phase = "rate hydration";
    if (spec.responseType === "json") {
      const body = await response.text();
      JSON.parse(body);
      return body;
    }
    await page.waitForFunction(
      (readiness) => {
        if (readiness.responseType === "links") {
          return [...document.querySelectorAll("a[href]")].some((link) =>
            new RegExp(readiness.linkTextPattern, "u").test(
              link.textContent?.trim() ?? ""
            )
          );
        }
        const cells = [...document.querySelectorAll(readiness.selector)];
        const ratePattern = new RegExp(
          readiness.rateTextPattern ?? "\\d+(?:\\.\\d+)?\\s*%",
          "u"
        );
        return (
          cells.filter((cell) =>
            ratePattern.test(cell.textContent?.trim() ?? "")
          ).length >= readiness.minimumRates
        );
      },
      spec,
      { timeout: Math.min(timeoutMs, 30_000) }
    );
    if (new URL(page.url()).origin !== origin.origin) {
      throw new Error("Browser source redirected to another origin");
    }
    return await page.content();
  } catch (error) {
    throw browserFailure(error, phase);
  } finally {
    await (ownsContext ? closeContext(context) : closePage(page));
  }
}

async function navigateToRates(
  page: Page,
  url: string,
  challenge: boolean,
  timeoutMs: number
): Promise<BrowserResponse> {
  // Register before navigation: a challenge can reload immediately after DOMContentLoaded.
  const resolved = challenge
    ? page
        .waitForResponse(
          (response) =>
            response.request().isNavigationRequest() &&
            response.frame() === page.mainFrame() &&
            new URL(response.url()).origin === new URL(url).origin &&
            response.ok(),
          { timeout: timeoutMs }
        )
        .then(
          (response) => response,
          () => null
        )
    : undefined;
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  if (response?.ok()) {
    return response;
  }
  if (challenge && response?.status() === 403) {
    const verified = await resolved;
    if (verified) {
      return verified;
    }
    throw new RetryableBrowserError(
      "Browser security challenge did not resolve"
    );
  }
  throw new Error(
    `Browser page returned HTTP ${response?.status() ?? "unknown"}`
  );
}

async function closePage(page: Page | undefined): Promise<void> {
  try {
    await page?.close();
  } catch {
    throw new Error("Browser page cleanup failed");
  }
}

async function closeContext(
  context: BrowserContext | undefined
): Promise<void> {
  try {
    await context?.close();
  } catch {
    throw new Error("Browser page cleanup failed");
  }
}
