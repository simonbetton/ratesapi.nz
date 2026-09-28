import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes } from "react";

import { DocsLink } from "@/components/docs-link";
import { isApiPath, toApiUrl } from "@/lib/api-url";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}

export function ApiLink({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  // Docs pages go through next/link so they get the /docs base path.
  if (href?.startsWith("/") && !isApiPath(href)) {
    return (
      <DocsLink href={href} {...props}>
        {children}
      </DocsLink>
    );
  }

  return (
    <a href={href === undefined ? href : toApiUrl(href)} {...props}>
      {children}
    </a>
  );
}
