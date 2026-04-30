import { docsSource } from "@rates-api/docs/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { type ReactNode } from "react";
import { baseOptions } from "../../lib/layout.shared";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={docsSource.getPageTree()}
      sidebar={{
        defaultOpenLevel: 3,
      }}
      {...baseOptions()}
    >
      {children}
    </DocsLayout>
  );
}
