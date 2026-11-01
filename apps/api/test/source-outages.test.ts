import { describe, expect, test } from "bun:test";

import {
  createCollectionTransport,
  openBrowserSession,
} from "../bin/direct/browser";
import {
  collectDirectDataset,
  createSourceFetcher,
} from "../bin/direct/collect";
import { SourceUnavailableError } from "../bin/direct/failures";
import { publishDirectDataset } from "../bin/direct/run";
import { createRecoverableCollectionTransport } from "../bin/direct/transport";
import type { DirectSource, Institution } from "../bin/direct/types";
import type { SupportedModels } from "../src/lib/data-loader";

const registry: Institution[] = ["anz", "midlands"].map((id) => ({
  id,
  name: id,
  datasets: {
    "mortgage-rates": { status: "active", reason: "Test", legacyProducts: [] },
  },
}));
const sources: DirectSource[] = registry.map(({ id }) => ({
  id: `${id}-mortgage`,
  institution: id,
  dataset: "mortgage-rates",
  urls: [`https://${id}.example/rates`],
  parse: () => [
    {
      product: "Standard",
      rate: 5,
      termInMonths: 12,
      sourceUrl: `https://${id}.example/rates`,
    },
  ],
}));

const forbidden = async () => {
  throw new Error("Must preserve database untouched");
};

describe("source outage isolation", () => {
  test.each([
    "mortgage-rates",
    "personal-loan-rates",
    "car-loan-rates",
    "credit-card-rates",
  ] as const)(
    "%s outages preserve stale data while healthy institutions publish",
    async (dataset) => {
      const selectedRegistry: Institution[] = registry.map((institution) => ({
        ...institution,
        datasets: { [dataset]: institution.datasets["mortgage-rates"] },
      }));
      const selectedSources = sources.map((source) => ({ ...source, dataset }));
      const previous = await collectDirectDataset(
        dataset,
        selectedRegistry,
        selectedSources,
        async () => "rates",
        new Date("2026-10-01")
      );
      const result = await collectDirectDataset(
        dataset,
        selectedRegistry,
        selectedSources.map((source) => ({
          ...source,
          parse: () =>
            source.parse(new Map()).map((rate) => ({ ...rate, rate: 6 })),
        })),
        async (url) => {
          if (url.includes("midlands")) {
            throw new SourceUnavailableError("Connection timed out");
          }
          return "rates";
        },
        new Date("2026-10-22")
      );
      expect(result.blockers).toEqual([]);
      expect(result.warnings).toEqual([
        "midlands-mortgage: Connection timed out",
      ]);
      expect(result.model).toBeNull();
      expect(result.publishable?.data.map(({ id }) => id)).toEqual([
        dataset === "credit-card-rates" ? "issuer:anz" : "institution:anz",
      ]);
      let saved: SupportedModels | null = null;
      let checked = false;
      await expect(
        publishDirectDataset({
          collect: async () => result,
          load: async () => previous.model,
          registry: selectedRegistry,
          save: async (model, options) => {
            saved = model;
            expect(options.complete).toBe(false);
            return true;
          },
          markChecked: async () => {
            checked = true;
          },
        })
      ).resolves.toBe("saved");
      const rateField =
        dataset === "credit-card-rates" ? "purchaseRate" : "rate";
      expect(JSON.stringify(saved)).toContain(`"${rateField}":6`);
      expect(JSON.stringify(saved)).toContain(`"${rateField}":5`);
      expect(JSON.stringify(saved)).toContain(
        '"lastUpdated":"2026-10-01T00:00:00.000Z"'
      );
      expect(checked).toBe(false);
    }
  );

  test("cloud HTTP 402 warns through collection and recovery without repeated session requests", async () => {
    const selectedSources: DirectSource[] = sources.map((source) => ({
      ...source,
      ...(source.institution === "midlands"
        ? {
            browser: {
              "https://midlands.example/rates": {
                selector: "td",
                minimumRates: 1,
              },
            },
          }
        : {}),
    }));
    const unavailableSource = selectedSources.find(
      (source) => source.institution === "midlands"
    );
    if (!unavailableSource) {
      throw new Error("Missing test source");
    }
    selectedSources.push({
      ...unavailableSource,
      id: "midlands-secondary",
      urls: ["https://midlands.example/other-rates"],
      browser: {
        "https://midlands.example/other-rates": {
          selector: "td",
          minimumRates: 1,
        },
      },
    });
    let sessionRequests = 0;
    const secret = "test-key-must-not-be-logged";
    const transport = createRecoverableCollectionTransport(
      selectedSources,
      (selected) =>
        createCollectionTransport(selected, {
          mode: "cloud",
          apiKey: secret,
          http: async () => "rates",
          open: (host, key) =>
            openBrowserSession(host, key, {
              fetch: async () => {
                sessionRequests += 1;
                return new Response(secret, { status: 402 });
              },
              launch: forbidden,
              connect: forbidden,
            }),
        })
    );
    try {
      const result = await collectDirectDataset(
        "mortgage-rates",
        registry,
        selectedSources,
        transport.fetchPage,
        undefined,
        { retryFetchPage: transport.retryFetchPage }
      );
      expect(result.blockers).toEqual([]);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings?.join(" ")).toContain("HTTP 402");
      expect(result.warnings?.join(" ")).toContain("credits");
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(JSON.stringify(transport.attempts)).not.toContain(secret);
      expect(sessionRequests).toBe(2);
      expect(
        result.sources.filter((source) => source.status === "failed")
      ).toEqual([
        expect.objectContaining({
          failureKind: "outage",
          initialFailureKind: "outage",
          attempts: 2,
        }),
        expect.objectContaining({
          failureKind: "outage",
          initialFailureKind: "outage",
          attempts: 2,
        }),
      ]);
      await expect(
        publishDirectDataset({
          collect: async () => result,
          load: async () => result.publishable,
          save: forbidden,
          markChecked: forbidden,
          registry,
        })
      ).resolves.toBe("unchanged");
    } finally {
      await transport.close();
    }
  });

  test("an all-outage collection warns without reading, writing or refreshing the database", async () => {
    const result = await collectDirectDataset(
      "mortgage-rates",
      registry,
      sources,
      async () => {
        throw new SourceUnavailableError("DNS unavailable");
      }
    );
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toHaveLength(2);
    expect(result.publishable).toBeNull();
    await expect(
      publishDirectDataset({
        collect: async () => result,
        load: forbidden,
        save: forbidden,
        markChecked: forbidden,
        registry,
      })
    ).resolves.toBe("unchanged");
  });

  test("an outage cannot hide an extraction failure or a persistence error", async () => {
    const changed = sources.map((source) =>
      source.institution === "anz"
        ? {
            ...source,
            parse: () => {
              throw new Error("Missing rate table");
            },
          }
        : source
    );
    const result = await collectDirectDataset(
      "mortgage-rates",
      registry,
      changed,
      async (url) => {
        if (url.includes("midlands")) {
          throw new SourceUnavailableError("Connection timed out");
        }
        return "rates";
      }
    );
    expect(result.blockers).toContain("anz-mortgage: Missing rate table");
    expect(
      result.sources.find((source) => source.institution === "anz")?.failureKind
    ).toBe("extraction");
    const partial = await collectDirectDataset(
      "mortgage-rates",
      registry,
      sources,
      async (url) => {
        if (url.includes("midlands")) {
          throw new SourceUnavailableError("Connection timed out");
        }
        return "rates";
      }
    );
    await expect(
      publishDirectDataset({
        collect: async () => partial,
        load: async () => null,
        save: async () => false,
        markChecked: async () => {},
        registry,
      })
    ).rejects.toThrow("Failed to save");
  });

  test("a recovery outage does not hide a reproducible extraction failure from the first attempt", async () => {
    const result = await collectDirectDataset(
      "mortgage-rates",
      registry,
      sources.map((source) => ({
        ...source,
        parse: () => {
          throw new Error("Changed table");
        },
      })),
      async () => "rates",
      undefined,
      {
        retryFetchPage: async () => {
          throw new SourceUnavailableError("Connection timed out");
        },
      }
    );
    expect(result.blockers.join(" ")).toContain("Changed table");
  });
  test("only transport failures can be downgraded to outage warnings", async () => {
    const result = await collectDirectDataset(
      "mortgage-rates",
      registry,
      sources.map((source) => ({
        ...source,
        parse: () => {
          throw new SourceUnavailableError("Parser regression");
        },
      })),
      async () => "rates"
    );
    expect(result.warnings).toEqual([]);
    expect(result.blockers).toHaveLength(2);
    expect(
      result.sources.every((source) => source.failureKind === "extraction")
    ).toBe(true);
  });
});

describe("HTTP outage classification", () => {
  test.each([403, 408, 429, 500, 502, 503, 504])(
    "HTTP %i is reported as source unavailability",
    async (status) => {
      await expect(
        createSourceFetcher(
          async () => new Response("Unavailable", { status })
        )("https://bank.example/rates")
      ).rejects.toBeInstanceOf(SourceUnavailableError);
    }
  );
  test("a nested connection timeout is classified without leaking socket details", async () => {
    const fetchPage = createSourceFetcher(async () => {
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error("private socket details"), {
          code: "UND_ERR_CONNECT_TIMEOUT",
        }),
      });
    });
    const error = await fetchPage("https://bank.example/rates").catch(
      (caughtError: unknown) => caughtError
    );
    expect(error).toBeInstanceOf(SourceUnavailableError);
    expect(String(error)).not.toContain("private socket details");
  });
  test.each([404, 401, 402])(
    "HTTP %i remains a blocking failure",
    async (status) => {
      const error = await createSourceFetcher(
        async () => new Response("Failure", { status })
      )("https://bank.example/rates").catch(
        (caughtError: unknown) => caughtError
      );
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(SourceUnavailableError);
    }
  );
  test("invalid content remains blocking even if its text resembles an outage", async () => {
    const error = await createSourceFetcher(
      async () =>
        new Response("not a PDF", {
          headers: { "content-type": "application/pdf" },
        })
    )("https://bank.example/rates").catch(
      (caughtError: unknown) => caughtError
    );
    expect(error).not.toBeInstanceOf(SourceUnavailableError);
  });
});
