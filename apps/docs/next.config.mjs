import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

// The landing page owns the site root, so the docs are served under /docs.
// Keep in sync with lib/base-path.ts.
const basePath = "/docs";

// The API Worker serves the OpenAPI reference. Locally it runs on its own
// port. Keep in sync with lib/api-url.ts.
const openApiReferenceUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8787/openapi"
    : "/openapi";

// Security headers for all docs responses. The docs are not made to be shown
// in a frame. HSTS applies to the whole domain, so it belongs in the
// Cloudflare zone settings, not here.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  basePath,
  poweredByHeader: false,
  reactStrictMode: true,
  headers() {
    return Promise.resolve([
      {
        // Next.js adds the base path, so this matches /docs and /docs/*.
        source: "/:path*",
        headers: securityHeaders,
      },
    ]);
  },
  redirects() {
    return Promise.resolve([
      {
        // Endpoint pages moved to the OpenAPI reference served by the API Worker.
        // The destination is outside the docs, so opt out of the base path.
        source: `${basePath}/api-reference/endpoint/:path*`,
        destination: openApiReferenceUrl,
        basePath: false,
        permanent: true,
      },
      {
        // The old introduction page only linked to the API reference.
        source: `${basePath}/api-reference/introduction`,
        destination: `${basePath}/api-reference`,
        basePath: false,
        permanent: true,
      },
    ]);
  },
};

export default withMDX(nextConfig);
