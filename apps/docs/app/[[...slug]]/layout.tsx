import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { type ReactNode } from "react";
import { source } from "@/lib/source";
import { baseOptions } from "../../lib/layout.shared";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      sidebar={{
        defaultOpenLevel: 3,
      }}
      {...baseOptions()}
    >
      {children}
    </DocsLayout>
  );
}
