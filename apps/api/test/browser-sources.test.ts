import { describe, expect, setDefaultTimeout, test } from "bun:test";

import { chromium } from "playwright";
import type { Browser } from "playwright";

import {
  browserMode,
  createCollectionTransport,
  openBrowserSession,
  renderPage,
} from "../bin/direct/browser";
import type { DirectSource } from "../bin/direct/types";

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

describe("browser host lifecycle", () => {
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

const browserTest = process.env.RUN_BROWSER_TESTS === "1" ? test : test.skip;
// Browser startup and multiple context lifecycles can exceed Bun's 5s default on CI.
// This changes only the test budget; production timeouts and assertions stay strict.
setDefaultTimeout(30_000);
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
                  : { contentType: "text/html", body }
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

describe("real Chromium transport", () => {
  browserTest(
    "reads tables with percentage units in their heading",
    async () => {
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
    }
  );

  browserTest(
    "requires a named disclosure link and renders approved discovered pages",
    async () => {
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
    }
  );

  browserTest(
    "reads exact JSON feed responses through a browser and rejects HTML masquerading as a feed",
    async () => {
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
    }
  );

  browserTest(
    "waits for a security interstitial to navigate successfully and preserves the cloud default context",
    async () => {
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
    }
  );

  browserTest(
    "a persistent 403 cannot be accepted even if it contains percentages",
    async () => {
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
    }
  );

  browserTest(
    "replaces a failed cloud proxy once, then caches the successful page",
    async () => {
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
    }
  );

  browserTest(
    "a persistent cloud connection failure stops after two attempts and releases both sessions",
    async () => {
      const fixture = await fixtureBrowser(html, 200, false, true);
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
            browser: fixture.browser,
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
        expect(transport.attempts).toHaveLength(2);
        expect(fixture.pages()).toBe(2);
      } finally {
        await transport.close();
        await fixture.close();
      }
      expect(closed).toEqual(["nz", "au"]);
    }
  );

  browserTest(
    "waits for the rate feed and hydrated cells, ignoring unrelated percentages",
    async () => {
      const fixture = await fixtureBrowser();
      try {
        const result = await renderPage(fixture.browser, url, spec, 5000);
        expect(result).toContain("<td>4.95%</td><td>5.25%</td>");
        expect(fixture.browser.contexts()).toHaveLength(0);
      } finally {
        await fixture.close();
      }
    }
  );

  browserTest(
    "a failed feed cannot validate embedded fallback rates",
    async () => {
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
    }
  );

  browserTest("an access-denied page cannot satisfy readiness", async () => {
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

  browserTest(
    "rejects cross-origin redirects before contacting the new origin",
    async () => {
      const fixture = await fixtureBrowser(html, 200, true);
      try {
        await expect(
          renderPage(fixture.browser, url, spec, 5000)
        ).rejects.toThrow("navigation");
        expect(fixture.crossOriginRequests()).toBe(0);
      } finally {
        await fixture.close();
      }
    }
  );

  browserTest(
    "auto fallback is cached across adapters and always closes both hosts",
    async () => {
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
    }
  );
});
