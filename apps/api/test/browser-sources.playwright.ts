import { chromium } from "playwright";
import type { Browser } from "playwright";
import { expect, test } from "playwright/test";

import {
  browserMode,
  createCollectionTransport,
  openBrowserSession,
  renderPage,
} from "../bin/direct/browser";
import { createSourceFetcher } from "../bin/direct/collect";
import { directSources } from "../bin/direct/sources";
import { createRecoverableCollectionTransport } from "../bin/direct/transport";
import type { DirectSource } from "../bin/direct/types";
import responses from "./fixtures/direct/responses.json" with { type: "json" };

const sessionId = "11111111-1111-1111-1111-111111111111";
const secret = "test-key-must-never-be-logged";
const cdpUrl = `wss://browser.example/connect?apiKey=${secret}`;

function cloudDependencies(connectFailure = false, closeFailure = false) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let disconnected = false;
  return {
    calls,
    disconnected: () => disconnected,
    deps: {
      async fetch(url: string, init?: RequestInit) {
        calls.push({ url, init });
        return Response.json(
          init?.method === "POST"
            ? { id: sessionId, cdpUrl }
            : { status: "stopped" }
        );
      },
      async launch(): Promise<Browser> {
        throw new Error("Unexpected local launch");
      },
      async connect(): Promise<Browser> {
        if (connectFailure) {
          throw new Error(`Cannot connect to ${cdpUrl}`);
        }
        return {
          async close() {
            disconnected = true;
            if (closeFailure) {
              throw new Error("disconnect failed");
            }
          },
        } as unknown as Browser;
      },
    },
  };
}

test.describe("browser host lifecycle", () => {
  test("cloud sessions use NZ routing and are explicitly stopped after disconnect", async () => {
    const mock = cloudDependencies();
    const session = await openBrowserSession("cloud", secret, mock.deps);
    await session.close();
    expect(mock.disconnected()).toBe(true);
    expect(mock.calls.map((call) => [call.url, call.init?.method])).toEqual([
      ["https://api.browser-use.com/api/v4/browsers", "POST"],
      [`https://api.browser-use.com/api/v4/browsers/${sessionId}`, "PATCH"],
    ]);
    expect(JSON.parse(String(mock.calls[0]?.init?.body))).toMatchObject({
      proxyCountryCode: "nz",
      timeout: 15,
      enableRecording: false,
    });
    expect(JSON.parse(String(mock.calls[1]?.init?.body))).toEqual({
      action: "stop",
    });
  });

  test("a failed CDP connection stops the billable session without leaking its URL", async () => {
    const mock = cloudDependencies(true);
    await expect(
      openBrowserSession("cloud", secret, mock.deps)
    ).rejects.toThrow("Browser Use CDP connection failed");
    expect(mock.calls.at(-1)?.init?.method).toBe("PATCH");
  });

  test("disconnect failure still stops the cloud session", async () => {
    const mock = cloudDependencies(false, true);
    const session = await openBrowserSession("cloud", secret, mock.deps);
    await expect(session.close()).rejects.toThrow();
    expect(mock.calls.at(-1)?.init?.method).toBe("PATCH");
  });

  test("API errors report status without echoing credentials or response bodies", async () => {
    const mock = cloudDependencies();
    mock.deps.fetch = async () => new Response(secret, { status: 402 });
    await expect(
      openBrowserSession("cloud", secret, mock.deps)
    ).rejects.toThrow("Browser Use session creation returned HTTP 402");
  });

  test("accepts the HTTPS CDP endpoint returned by the live v4 API", async () => {
    const mock = cloudDependencies();
    const { fetch } = mock.deps;
    const endpoint = "https://session.cdp.browser-use.com";
    mock.deps.fetch = async (url, init) =>
      init?.method === "POST"
        ? Response.json({ id: sessionId, cdpUrl: endpoint })
        : fetch(url, init);
    let connectedUrl = "";
    const { connect } = mock.deps;
    const session = await openBrowserSession("cloud", secret, {
      ...mock.deps,
      async connect(url) {
        connectedUrl = url;
        return connect();
      },
    });
    await session.close();
    expect(connectedUrl).toBe(endpoint);
    expect(mock.calls.at(-1)?.init?.method).toBe("PATCH");
  });

  test("invalid CDP URLs still release a created session", async () => {
    const mock = cloudDependencies();
    const { fetch } = mock.deps;
    mock.deps.fetch = async (url, init) =>
      init?.method === "POST"
        ? Response.json({ id: sessionId, cdpUrl: "http://insecure.example" })
        : fetch(url, init);
    await expect(
      openBrowserSession("cloud", secret, mock.deps)
    ).rejects.toThrow("CDP connection failed");
    expect(mock.calls.at(-1)?.init?.method).toBe("PATCH");
  });

  test("configuration errors fail before making network requests", () => {
    expect(() => browserMode("typo")).toThrow("auto, local, or cloud");
    expect(() =>
      createCollectionTransport([], { mode: "cloud", apiKey: "" })
    ).toThrow("requires BROWSER_USE_API_KEY");
    expect(() =>
      createCollectionTransport([
        {
          id: "bad",
          institution: "bank",
          dataset: "mortgage-rates",
          urls: [],
          browser: {
            "https://bank.example": { selector: "td", minimumRates: 1 },
          },
          parse: () => [],
        },
      ])
    ).toThrow("not declared");
  });
});

const url = "https://bank.example/rates";
const feed = "https://bank.example/feed";
const spec = {
  selector: "#rates td",
  minimumRates: 2,
  requiredResponses: [feed],
};
const html = `<p>Unrelated fee: 99%</p><table id="rates"><tr><td></td><td></td></tr></table><script>
fetch('/feed').then(r => r.json()).then(r => { document.querySelector('#rates').innerHTML = '<tr><td>' + r[0] + '%</td><td>' + r[1] + '%</td></tr>'; });
</script>`;

async function fixtureBrowser(
  body = html,
  feedStatus = 200,
  redirect = false,
  connectionFailure = false
) {
  const browser = await chromium.launch({ headless: true });
  let pages = 0;
  let crossOriginRequests = 0;
  const wrapped = new Proxy(browser, {
    get(target, property) {
      if (property === "newContext") {
        return async () => {
          const context = await target.newContext();
          await context.route("**/*", async (route) => {
            const requestUrl = route.request().url();
            if (requestUrl === feed) {
              await route.fulfill({
                status: feedStatus,
                contentType: "application/json",
                body: "[4.95,5.25]",
              });
            } else if (requestUrl === url) {
              pages += 1;
              if (connectionFailure) {
                await route.abort("connectionreset");
                return;
              }
              await route.fulfill(
                redirect
                  ? {
                      status: 302,
                      headers: { location: "https://outside.example/rates" },
                    }
                  : { contentType: "text/html; charset=utf-8", body }
              );
            } else {
              crossOriginRequests += 1;
              await route.abort();
            }
          });
          return context;
        };
      }
      const value: unknown = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return {
    browser: wrapped,
    close: () => browser.close(),
    pages: () => pages,
    crossOriginRequests: () => crossOriginRequests,
  };
}

test.describe("real Chromium transport", () => {
  for (const id of [
    "fhl-personal",
    "fhl-car",
    "gold-band-personal-loan-rates",
    "gold-band-car-loan-rates",
  ]) {
    test(`${id} renders its reviewed disclosure after runner access denial`, async () => {
      const source = directSources.find((item) => item.id === id);
      const sourceUrl = source?.urls[0];
      const readiness = sourceUrl ? source?.browser?.[sourceUrl] : undefined;
      if (!source || !sourceUrl || !readiness) {
        throw new Error(`${id} must have browser readiness`);
      }
      const pages = new Map(Object.entries(responses));
      const fixture = await fixtureBrowser(pages.get(sourceUrl));
      const transport = createCollectionTransport(
        [{ ...source, urls: [url], browser: { [url]: readiness } }],
        {
          mode: "auto",
          apiKey: secret,
          async open(host) {
            if (host === "local") {
              throw new Error("Runner access denied");
            }
            return { browser: fixture.browser, close: fixture.close };
          },
        }
      );
      try {
        const body = await transport.fetchPage(url);
        const rendered = new Map(pages).set(sourceUrl, body);
        expect(source.parse(rendered)).toEqual(source.parse(pages));
        expect(source.discover?.(rendered)).toEqual(source.discover?.(pages));
        expect(
          transport.attempts.map(({ host, status }) => [host, status])
        ).toEqual([
          ["local", "failed"],
          ["cloud", "ok"],
        ]);
      } finally {
        await transport.close();
        await fixture.close();
      }
      const invalid = await fixtureBrowser(
        "<p>Default interest 10%. Temporarily unavailable.</p>"
      );
      try {
        await expect(
          renderPage(invalid.browser, url, readiness, 250)
        ).rejects.toThrow("rate hydration");
      } finally {
        await invalid.close();
      }
    });
  }

  test("Future Finance recovers a runner timeout through cloud and validates the advertised range", async () => {
    const source = directSources.find(
      (item) => item.id === "future-finance-personal-loan-rates"
    );
    const sourceUrl = source?.urls[0];
    const readiness = sourceUrl ? source?.browser?.[sourceUrl] : undefined;
    if (!source || !sourceUrl || !readiness) {
      throw new Error(
        "Future Finance must have browser readiness for its disclosure"
      );
    }
    const fixture = await fixtureBrowser(
      responses["https://www.futurefinance.co.nz/interest-rates"]
    );
    const cloudContext = await fixture.browser.newContext();
    let cloudPages = 0;
    cloudContext.on("page", () => {
      cloudPages += 1;
    });
    const transport = createCollectionTransport(
      [{ ...source, urls: [url], browser: { [url]: readiness } }],
      {
        mode: "auto",
        apiKey: secret,
        async open(host) {
          if (host === "local") {
            throw new Error("Runner connection timed out");
          }
          return { browser: fixture.browser, close: fixture.close };
        },
      }
    );
    try {
      const body = await transport.fetchPage(url);
      expect(cloudPages).toBe(1);
      expect(source.parse(new Map([[sourceUrl, body]]))).toMatchObject([
        {
          product: "Personal Loan",
          rate: 11.99,
          rateMaximum: 27.99,
          rateType: "range",
          sourceUrl,
        },
      ]);
      expect(
        transport.attempts.map(({ host, status }) => ({ host, status }))
      ).toEqual([
        { host: "local", status: "failed" },
        { host: "cloud", status: "ok" },
      ]);
    } finally {
      await transport.close();
      await fixture.close();
    }
    const irrelevant =
      "<p>Default interest is 10% greater than the annual rate. Representative example: 12.99%.</p>";
    const invalid = await fixtureBrowser(irrelevant);
    try {
      await expect(
        renderPage(invalid.browser, url, readiness, 250)
      ).rejects.toThrow("rate hydration");
      expect(() => source.parse(new Map([[sourceUrl, irrelevant]]))).toThrow();
    } finally {
      await invalid.close();
    }
  });

  for (const dataset of ["personal-loan-rates", "car-loan-rates"]) {
    test(`Finance Now ${dataset} recovers runner access denial and validates the rendered promotion`, async () => {
      const source = directSources.find(
        (item) => item.id === `finance-now-${dataset}`
      );
      const sourceUrl = source?.urls[0];
      if (!source || !sourceUrl) {
        throw new Error("Missing Finance Now source");
      }
      const fixture = await fixtureBrowser(
        responses["https://www.financenow.co.nz/personal-loans/"]
      );
      const readiness = source.browser?.[sourceUrl];
      const transport = createCollectionTransport(
        [
          {
            ...source,
            urls: [url],
            browser: readiness ? { [url]: readiness } : undefined,
          },
        ],
        {
          mode: "auto",
          apiKey: secret,
          http: async () => {
            throw new Error("HTTP 403");
          },
          open: async (host) => {
            if (host === "local") {
              throw new Error("Browser page returned HTTP 403");
            }
            return { browser: fixture.browser, close: fixture.close };
          },
        }
      );
      try {
        const body = await transport.fetchPage(url);
        expect(source.parse(new Map([[sourceUrl, body]]))).toMatchObject([
          {
            product: "Personal Loan",
            rate: 8.25,
            rateMaximum: 29.95,
            rateType: "range",
            sourceUrl,
          },
        ]);
        expect(
          transport.attempts.map(({ host, status }) => ({ host, status }))
        ).toEqual([
          { host: "local", status: "failed" },
          { host: "cloud", status: "ok" },
        ]);
        const expired = body.replace(
          /until \d{1,2} [A-Za-z]+ \d{4}/u,
          "until 1 January 2020"
        );
        expect(() => source.parse(new Map([[sourceUrl, expired]]))).toThrow(
          "promotion has expired"
        );
      } finally {
        await transport.close();
        await fixture.close();
      }
    });
  }

  test("Midlands recovers a runner connection failure through a browser and validates the borrower rate", async () => {
    const source = directSources.find(
      (item) => item.id === "midlands-mortgage"
    );
    const sourceUrl = source?.urls[0];
    if (!source || !sourceUrl) {
      throw new Error("Missing Midlands source");
    }
    const readiness = source.browser?.[sourceUrl];
    const fixture = await fixtureBrowser(
      "<h3>What interest rate do you charge borrowers?</h3> <p>Our interest rates are floating and currently start at 7.50% per annum.</p>"
    );
    const transport = createCollectionTransport(
      [
        {
          ...source,
          urls: [url],
          browser: readiness ? { [url]: readiness } : undefined,
        },
      ],
      {
        mode: "auto",
        apiKey: secret,
        http: async () => {
          throw new TypeError("fetch failed");
        },
        open: async (host) => {
          if (host === "local") {
            throw new Error("Runner connection failed");
          }
          return { browser: fixture.browser, close: fixture.close };
        },
      }
    );
    try {
      const body = await transport.fetchPage(url);
      expect(source.parse(new Map([[sourceUrl, body]]))).toMatchObject([
        { rate: 7.5, rateType: "from", sourceUrl },
      ]);
      expect(
        transport.attempts.map(({ host, status }) => ({ host, status }))
      ).toEqual([
        { host: "local", status: "failed" },
        { host: "cloud", status: "ok" },
      ]);
    } finally {
      await transport.close();
      await fixture.close();
    }
  });

  test("Aotea waits for a rendered disclosure instead of parsing an empty response shell", async () => {
    const source = directSources.find(
      (item) => item.id === "aotea-finance-personal-loan-rates"
    );
    const sourceUrl = source?.urls[0];
    const readiness = sourceUrl ? source?.browser?.[sourceUrl] : undefined;
    if (!source || !sourceUrl || !readiness) {
      throw new Error("Aotea must have browser readiness for its disclosure");
    }
    const fixture = await fixtureBrowser(`<script>setTimeout(() => {
      document.body.innerHTML = '<p>Annual Interest Rate is fixed for the whole contract being from 22.5% to 32.50%.</p><p>Annual Default Interest rate is 7% above the stated Annual Interest Rate.</p>';
    }, 700);</script>`);
    try {
      const body = await renderPage(fixture.browser, url, readiness, 5000);
      expect(source.parse(new Map([[sourceUrl, body]]))).toMatchObject([
        { rate: 22.5, rateMaximum: 32.5, rateType: "range", sourceUrl },
      ]);
    } finally {
      await fixture.close();
    }
  });

  test("reads tables with percentage units in their heading", async () => {
    const fixture = await fixtureBrowser(
      "<p>Unrelated rate: 99%</p><table><tr><th>% p.a.</th></tr><tr><td> 4.95 </td><td>5.25*</td></tr></table>"
    );
    try {
      const body = await renderPage(
        fixture.browser,
        url,
        {
          selector: "table td",
          minimumRates: 2,
          rateTextPattern: "^\\d+(?:\\.\\d+)?\\*?$",
        },
        5000
      );
      expect(body).toContain("5.25");
      expect(fixture.browser.contexts()).toHaveLength(0);
    } finally {
      await fixture.close();
    }
  });

  test("requires a named disclosure link and renders approved discovered pages", async () => {
    const fixture = await fixtureBrowser(`<p>Unrelated rate: 99%</p><script>
setTimeout(() => {
  const link = document.createElement('a');
  link.href = '/current-rates';
  link.textContent = 'Residential Mortgage Interest Rates (20260820)';
  document.body.append(link);
}, 50);
</script>`);
    const invalid = await fixtureBrowser("<p>Unavailable. Example: 99%</p>");
    const links = {
      responseType: "links" as const,
      linkTextPattern: "^Residential Mortgage Interest Rates \\(\\d{8}\\)",
    };
    const transport = createCollectionTransport([], {
      mode: "local",
      http: () => {
        throw new Error("Discovered browser pages must not use plain HTTP");
      },
      open: async () => fixture,
    });
    try {
      const body = await transport.fetchPage(url, links);
      expect(body).toContain('<a href="/current-rates">');
      expect(transport.attempts[0]?.status).toBe("ok");
      await expect(
        renderPage(invalid.browser, url, links, 5000)
      ).rejects.toThrow("rate hydration failed");
      expect(fixture.browser.contexts()).toHaveLength(0);
      expect(invalid.browser.contexts()).toHaveLength(0);
    } finally {
      await transport.close();
      await invalid.close();
    }
  });

  test("reads exact JSON feed responses through a browser and rejects HTML masquerading as a feed", async () => {
    const fixture = await fixtureBrowser(
      '{"results":[{"rate":"5.25","enabled":true}]}'
    );
    const invalid = await fixtureBrowser(
      "<html>Temporary security page, 5.25%</html>"
    );
    try {
      const body = await renderPage(
        fixture.browser,
        url,
        { responseType: "json" },
        5000
      );
      expect(JSON.parse(body)).toEqual({
        results: [{ rate: "5.25", enabled: true }],
      });
      await expect(
        renderPage(invalid.browser, url, { responseType: "json" }, 5000)
      ).rejects.toThrow("rate hydration failed");
      expect(fixture.browser.contexts()).toHaveLength(0);
      expect(invalid.browser.contexts()).toHaveLength(0);
    } finally {
      await fixture.close();
      await invalid.close();
    }
  });

  test("waits for a security interstitial to navigate successfully and preserves the cloud default context", async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    let requests = 0;
    await context.route(url, async (route) => {
      requests += 1;
      await route.fulfill(
        requests === 1
          ? {
              status: 403,
              contentType: "text/html",
              body: "<title>Just a moment...</title><script>setTimeout(() => location.reload(), 100)</script>",
            }
          : {
              status: 200,
              contentType: "text/html",
              body: "<table><tr><td>5.25%</td></tr></table>",
            }
      );
    });
    try {
      expect(
        await renderPage(
          browser,
          url,
          { selector: "td", minimumRates: 1, cloudChallenge: true },
          5000
        )
      ).toContain("5.25%");
      expect(requests).toBe(2);
      expect(browser.contexts()).toEqual([context]);
      expect(context.pages()).toHaveLength(0);
    } finally {
      await browser.close();
    }
  });

  test("a persistent 403 cannot be accepted even if it contains percentages", async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.route(url, (route) =>
      route.fulfill({
        status: 403,
        contentType: "text/html",
        body: "<table><tr><td>5.25%</td></tr></table>",
      })
    );
    try {
      await expect(
        renderPage(
          browser,
          url,
          { selector: "td", minimumRates: 1, cloudChallenge: true },
          5000
        )
      ).rejects.toThrow("security challenge did not resolve");
      expect(context.pages()).toHaveLength(0);
    } finally {
      await browser.close();
    }
  });

  test("replaces a failed cloud proxy once, then caches the successful page", async () => {
    const failed = await fixtureBrowser(html, 200, false, true);
    const working = await fixtureBrowser();
    const lifecycle: string[] = [];
    const source: DirectSource = {
      id: "bank",
      institution: "bank",
      dataset: "mortgage-rates",
      urls: [url],
      browser: { [url]: spec },
      parse: () => [],
    };
    const transport = createCollectionTransport([source], {
      mode: "cloud",
      apiKey: secret,
      async open(_host, _key, _deps, country) {
        lifecycle.push(`open:${country}`);
        return {
          browser: country === "nz" ? failed.browser : working.browser,
          close: async () => {
            lifecycle.push(`close:${country}`);
          },
        };
      },
    });
    try {
      const [first, second] = await Promise.all([
        transport.fetchPage(url),
        transport.fetchPage(url),
      ]);
      expect(first).toBe(second);
      expect(working.pages()).toBe(1);
      expect(lifecycle).toEqual(["open:nz", "close:nz", "open:au"]);
      expect(
        transport.attempts.map(({ status, proxyCountryCode }) => [
          status,
          proxyCountryCode,
        ])
      ).toEqual([
        ["failed", "nz"],
        ["ok", "au"],
      ]);
      expect(transport.attempts[0]?.error).toBe(
        "Browser navigation failed (ERR_CONNECTION_RESET)"
      );
    } finally {
      await transport.close();
      await failed.close();
      await working.close();
    }
    expect(lifecycle.at(-1)).toBe("close:au");
  });

  test("recovers after two dead proxies by alternating regions, then caches the validated page", async () => {
    const failed = await fixtureBrowser(html, 200, false, true);
    const working = await fixtureBrowser();
    const lifecycle: string[] = [];
    let opened = 0;
    const source: DirectSource = {
      id: "bank",
      institution: "bank",
      dataset: "mortgage-rates",
      urls: [url],
      browser: { [url]: spec },
      parse: () => [],
    };
    const transport = createCollectionTransport([source], {
      mode: "cloud",
      apiKey: secret,
      async open(_host, _key, _deps, country) {
        opened += 1;
        lifecycle.push(`open:${country}`);
        return {
          browser: opened < 3 ? failed.browser : working.browser,
          close: async () => {
            lifecycle.push(`close:${country}`);
          },
        };
      },
    });
    try {
      const result = await transport.fetchPage(url);
      expect(result).toContain("<td>4.95%</td><td>5.25%</td>");
      expect(await transport.fetchPage(url)).toBe(result);
      expect(working.pages()).toBe(1);
      expect(lifecycle).toEqual([
        "open:nz",
        "close:nz",
        "open:au",
        "close:au",
        "open:nz",
      ]);
      expect(
        transport.attempts.map(({ status, proxyCountryCode }) => [
          status,
          proxyCountryCode,
        ])
      ).toEqual([
        ["failed", "nz"],
        ["failed", "au"],
        ["ok", "nz"],
      ]);
    } finally {
      await transport.close();
      await failed.close();
      await working.close();
    }
    expect(lifecycle.at(-1)).toBe("close:nz");
  });

  test("a persistent cloud connection failure stops after three attempts and immediately releases every session", async () => {
    // Exercise the real retry and error-sanitization path without Chromium
    // process/IPC timing. Navigation failure itself is injected deterministically.
    let navigations = 0;
    let closedContexts = 0;
    const browser = {
      async newContext() {
        return {
          async newPage() {
            return {
              async route() {
                // This navigation-error double makes no network requests.
              },
              async goto() {
                navigations += 1;
                throw new Error(`net::ERR_CONNECTION_RESET at ${cdpUrl}`);
              },
            };
          },
          async close() {
            closedContexts += 1;
          },
        };
      },
    } as unknown as Browser;
    const closed: string[] = [];
    const source: DirectSource = {
      id: "bank",
      institution: "bank",
      dataset: "mortgage-rates",
      urls: [url],
      browser: { [url]: { selector: "td", minimumRates: 2 } },
      parse: () => [],
    };
    const transport = createCollectionTransport([source], {
      mode: "cloud",
      apiKey: secret,
      async open(_host, _key, _deps, country) {
        return {
          browser,
          close: async () => {
            closed.push(country ?? "unknown");
          },
        };
      },
    });
    try {
      await expect(transport.fetchPage(url)).rejects.toThrow(
        "ERR_CONNECTION_RESET"
      );
      expect(transport.attempts).toHaveLength(3);
      expect(navigations).toBe(3);
      expect(closedContexts).toBe(3);
      expect(JSON.stringify(transport.attempts)).not.toContain(secret);
      expect(closed).toEqual(["nz", "au", "nz"]);
    } finally {
      await transport.close();
    }
    expect(closed).toEqual(["nz", "au", "nz"]);
  });

  test("waits for the rate feed and hydrated cells, ignoring unrelated percentages", async () => {
    const fixture = await fixtureBrowser();
    try {
      const result = await renderPage(fixture.browser, url, spec, 5000);
      expect(result).toContain("<td>4.95%</td><td>5.25%</td>");
      expect(fixture.browser.contexts()).toHaveLength(0);
    } finally {
      await fixture.close();
    }
  });

  test("a failed feed cannot validate embedded fallback rates", async () => {
    const fixture = await fixtureBrowser(
      html.replace("<td></td><td></td>", "<td>1%</td><td>2%</td>"),
      403
    );
    try {
      await expect(
        renderPage(fixture.browser, url, spec, 5000)
      ).rejects.toThrow("Required first-party rate feed did not succeed");
      expect(fixture.browser.contexts()).toHaveLength(0);
    } finally {
      await fixture.close();
    }
  });

  test("an access-denied page cannot satisfy readiness", async () => {
    const fixture = await fixtureBrowser("<p>Access denied</p>");
    try {
      await expect(
        renderPage(
          fixture.browser,
          url,
          { selector: "td", minimumRates: 1 },
          5000
        )
      ).rejects.toThrow("rate hydration failed");
      expect(fixture.browser.contexts()).toHaveLength(0);
    } finally {
      await fixture.close();
    }
  });

  test("rejects cross-origin redirects before contacting the new origin", async () => {
    const fixture = await fixtureBrowser(html, 200, true);
    try {
      await expect(
        renderPage(fixture.browser, url, spec, 5000)
      ).rejects.toThrow("navigation");
      expect(fixture.crossOriginRequests()).toBe(0);
    } finally {
      await fixture.close();
    }
  });

  test("auto fallback is cached across adapters and always closes both hosts", async () => {
    const fixture = await fixtureBrowser();
    const closed: string[] = [];
    const source: DirectSource = {
      id: "bank",
      institution: "bank",
      dataset: "mortgage-rates",
      urls: [url],
      browser: { [url]: spec },
      parse: () => [],
    };
    const transport = createCollectionTransport([source], {
      mode: "auto",
      apiKey: secret,
      async open(host) {
        return {
          browser:
            host === "local"
              ? ({
                  async newContext() {
                    throw new Error(cdpUrl);
                  },
                } as unknown as Browser)
              : fixture.browser,
          async close() {
            closed.push(host);
          },
        };
      },
    });
    try {
      const [first, second] = await Promise.all([
        transport.fetchPage(url),
        transport.fetchPage(url),
      ]);
      expect(first).toBe(second);
      expect(fixture.pages()).toBe(1);
      expect(
        transport.attempts.map((attempt) => [attempt.host, attempt.status])
      ).toEqual([
        ["local", "failed"],
        ["cloud", "ok"],
      ]);
      expect(JSON.stringify(transport.attempts)).not.toContain(secret);
    } finally {
      await transport.close();
      await fixture.close();
    }
    expect(closed.toSorted()).toEqual(["cloud", "local"]);
  });
});

test.describe("collection recovery transport", () => {
  test("recovery uses a new HTTP cache and opens no extra transport on healthy runs", async () => {
    let requests = 0;
    let transports = 0;
    const transport = createRecoverableCollectionTransport([], (sources) => {
      transports += 1;
      return createCollectionTransport(sources, {
        mode: "local",
        http: createSourceFetcher(async () => {
          requests += 1;
          return new Response(requests === 1 ? "challenge" : "rates");
        }),
      });
    });
    try {
      expect(await transport.fetchPage("https://bank.example/rates")).toBe(
        "challenge"
      );
      expect(await transport.fetchPage("https://bank.example/rates")).toBe(
        "challenge"
      );
      expect(transports).toBe(1);
      expect(await transport.retryFetchPage("https://bank.example/rates")).toBe(
        "rates"
      );
      expect(transports).toBe(2);
      expect(requests).toBe(2);
    } finally {
      await transport.close();
    }
  });

  test("both transports are closed even if primary cleanup fails, preserving both attempt reports", async () => {
    let created = 0;
    const closed: number[] = [];
    const transport = createRecoverableCollectionTransport([], () => {
      created += 1;
      const id = created;
      return {
        fetchPage: async () => "rates",
        attempts: [
          { url: `https://bank.example/${id}`, host: "cloud", status: "ok" },
        ],
        close: async () => {
          closed.push(id);
          if (id === 1) {
            throw new Error("cleanup");
          }
        },
      };
    });
    await transport.retryFetchPage("https://bank.example/rates");
    expect(transport.attempts).toHaveLength(2);
    await expect(transport.close()).rejects.toThrow("cleanup failed");
    expect(closed).toEqual([1, 2]);
  });
});
