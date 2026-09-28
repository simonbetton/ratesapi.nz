"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

import { docsBasePath } from "@/lib/base-path";

import { DocsLink } from "./docs-link";

const components = { Link: DocsLink };

export function DocsProvider({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      components={components}
      search={{ options: { api: `${docsBasePath}/api/search` } }}
    >
      {children}
    </RootProvider>
  );
}
