import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { docsBasePath } from "@/lib/base-path";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Rates API",
    template: "%s | Rates API",
  },
  description:
    "Documentation for Rates API: New Zealand lending rates, MCP, OpenAPI, time-series endpoints, and deployment of the open source project.",
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
