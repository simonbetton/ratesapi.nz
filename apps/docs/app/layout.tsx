import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { docsBasePath } from "@/lib/base-path";
import { openGraphDefaults, twitterDefaults } from "@/lib/metadata";
import { siteName, siteOrigin, toSiteUrl } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  // Metadata URLs resolve against the site origin. Next.js does not add the
  // /docs base path to them, so pages give absolute URLs.
  metadataBase: new URL(siteOrigin),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description:
    "Documentation for Rates API, the free JSON API for New Zealand mortgage, personal loan, car loan and credit card interest rates.",
  openGraph: {
    ...openGraphDefaults,
    type: "website",
  },
  twitter: twitterDefaults,
  // The landing page Worker serves the icons at the site root.
  icons: {
    icon: [
      { url: toSiteUrl("/favicon.ico") },
      {
        url: toSiteUrl("/ratesapi-terminal-light.svg"),
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: toSiteUrl("/ratesapi-terminal-dark.svg"),
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: toSiteUrl("/apple-touch-icon.png"),
  },
};

export const viewport: Viewport = {
  themeColor: "#1a2035",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          search={{ options: { api: `${docsBasePath}/api/search` } }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
