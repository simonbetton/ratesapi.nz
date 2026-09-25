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

/** @type {import("next").NextConfig} */
const nextConfig = {
  basePath,
  reactStrictMode: true,
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
    ]);
  },
};

export default withMDX(nextConfig);
