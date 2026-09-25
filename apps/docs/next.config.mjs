import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

// The API Worker serves the OpenAPI reference. Locally it runs on its own
// port. Keep in sync with lib/api-url.ts.
const openApiReferenceUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8787/openapi"
    : "/openapi";

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  redirects() {
    return Promise.resolve([
      {
        // Endpoint pages moved to the OpenAPI reference served by the API Worker.
        source: "/api-reference/endpoint/:path*",
        destination: openApiReferenceUrl,
        permanent: true,
      },
    ]);
  },
};

export default withMDX(nextConfig);
