import { env } from "cloudflare:workers";

import { fetchKeyFacts } from "./key-facts";
import type { KeyFacts } from "./key-facts";

// Coverage changes at most hourly, so one lookup an hour is plenty.
const cacheSeconds = 60 * 60;
// After a failed lookup, serve the fallback for a minute before trying again,
// so a slow API can't add its timeout to every page view.
const retrySeconds = 60;
// The Cache API needs a URL key. Nothing is ever served from this URL.
const cacheKey = "https://www.ratesapi.nz/__cache/key-facts";

interface Cached {
  facts: KeyFacts | null;
  expires: number;
}

// Per isolate, in front of the per-colo Cache API below.
let memory: Cached | undefined;

// `caches.default` is Workers-only, so it isn't in the DOM types.
function defaultCache() {
  try {
    return (caches as CacheStorage & { default?: Cache }).default ?? null;
  } catch {
    return null;
  }
}

async function readCache(cache: Cache) {
  try {
    const response = await cache.match(cacheKey);
    return response ? ((await response.json()) as KeyFacts) : null;
  } catch {
    return null;
  }
}

async function writeCache(cache: Cache, facts: KeyFacts) {
  try {
    await cache.put(
      cacheKey,
      Response.json(facts, {
        headers: { "Cache-Control": `max-age=${cacheSeconds}` },
      })
    );
  } catch {
    // A cold cache only costs the next request a lookup.
  }
}

/**
 * The homepage's key facts, or null when the API can't be reached (for
 * example in local development, where the service binding has no API Worker
 * behind it). Callers render static wording for null.
 */
export async function loadKeyFacts(): Promise<KeyFacts | null> {
  const now = Date.now();
  if (memory && memory.expires > now) {
    return memory.facts;
  }

  const cache = defaultCache();
  const cached = cache ? await readCache(cache) : null;
  if (cached) {
    // The Cache API entry may be up to an hour old; recheck it in a minute.
    memory = { facts: cached, expires: now + retrySeconds * 1000 };
    return cached;
  }

  const api = env.RATES_API;
  const facts = api ? await fetchKeyFacts(api) : null;
  memory = {
    facts,
    expires: now + (facts ? cacheSeconds : retrySeconds) * 1000,
  };
  if (facts && cache) {
    await writeCache(cache, facts);
  }
  return facts;
}
