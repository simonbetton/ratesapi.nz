import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Rates API - Free NZ Interest Rates API",
      },
      {
        name: "description",
        content:
          "Build with free New Zealand mortgage, loan, and credit card data. JSON endpoints, historical rates, OpenAPI, and MCP. No account or API key required.",
      },
      {
        property: "og:title",
        content: "Rates API - Free NZ Interest Rates API",
      },
      {
        property: "og:description",
        content:
          "Latest and historical NZ lending rates for products, dashboards, and agent tools.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ratesapi.nz/" },
      { property: "og:site_name", content: "Rates API" },
      { property: "og:image", content: "https://ratesapi.nz/images/hero.webp" },
      {
        property: "og:image:alt",
        content: "New Zealand mountain lake landscape",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#1a2035" },
    ],
    links: [
      { rel: "canonical", href: "https://ratesapi.nz/" },
      {
        rel: "preload",
        href: "/fonts/Inter-Regular.woff2?v=3.19",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/ratesapi-terminal-light.svg",
        media: "(prefers-color-scheme: light)",
        type: "image/svg+xml",
      },
      {
        rel: "icon",
        href: "/ratesapi-terminal-dark.svg",
        media: "(prefers-color-scheme: dark)",
        type: "image/svg+xml",
      },
      {
        rel: "apple-touch-icon",
        href: "/ratesapi-terminal-light.svg",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="overflow-x-hidden bg-white font-sans text-[#131e40] antialiased [-webkit-tap-highlight-color:transparent] [text-rendering:optimizeLegibility]">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
