// Types for the one Workers module the landing page imports on the server.
// @cloudflare/workers-types would clash with the DOM types the client needs.
declare module "cloudflare:workers" {
  /** The bindings in wrangler.toml. */
  export const env: {
    /** The API Worker (apps/api). Missing when no API Worker is bound. */
    RATES_API?: {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    };
  };
}
