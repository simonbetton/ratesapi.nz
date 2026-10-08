import { createCollectionTransport } from "./browser";
import type { FetchPage } from "./collect";
import type { DirectSource } from "./types";

/** Separate caches and browser sessions for a single, delayed recovery pass. */
export function createRecoverableCollectionTransport(
  sources: readonly DirectSource[],
  createTransport = createCollectionTransport
) {
  const primary = createTransport(sources);
  let recovery: ReturnType<typeof createTransport> | undefined;
  const retryFetchPage: FetchPage = (url, readiness) => {
    recovery ??= createTransport(sources);
    return recovery.fetchPage(url, readiness);
  };
  return {
    fetchPage: primary.fetchPage,
    retryFetchPage,
    get attempts() {
      return [...primary.attempts, ...(recovery?.attempts ?? [])];
    },
    async close() {
      const results = await Promise.allSettled([
        primary.close(),
        recovery?.close(),
      ]);
      if (results.some((result) => result.status === "rejected")) {
        throw new Error(
          "Collection transport cleanup failed; cloud sessions expire after 15 minutes"
        );
      }
    },
  };
}
