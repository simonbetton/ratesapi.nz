import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        // Endpoint pages moved to the OpenAPI reference served by the API Worker.
        source: "/api-reference/endpoint/:path*",
        destination: "/openapi",
        permanent: true,
      },
    ];
  },
};

export default withMDX(nextConfig);
