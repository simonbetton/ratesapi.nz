import { RootProvider } from "fumadocs-ui/provider/next";
import { type Metadata } from "next";
import { type ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Rates API",
    template: "%s | Rates API",
  },
  description:
    "AI-ready Rates API documentation for New Zealand lending rates, MCP, OpenAPI, time series endpoints, and open-source deployment.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
