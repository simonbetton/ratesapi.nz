import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { type ReactNode } from "react";

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
          "A public JSON API for New Zealand mortgage, personal loan, car loan, and credit card rates.",
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
    ],
    links: [
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
