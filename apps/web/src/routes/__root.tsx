import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { NotFoundPage } from "#/components/not-found-page";

import appCss from "../styles.css?url";

// Only tags every page shares. The title, description, canonical, social tags
// and JSON-LD belong to the homepage route, so a 404 never repeats them.
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
      // Keep in sync with theme_color in public/manifest.json.
      { name: "theme-color", content: "#1a2035" },
    ],
    links: [
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
      // For browsers and crawlers that don't use the SVG icons below.
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
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
        href: "/apple-touch-icon.png",
        sizes: "180x180",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
    ],
  }),
  notFoundComponent: NotFoundPage,
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
