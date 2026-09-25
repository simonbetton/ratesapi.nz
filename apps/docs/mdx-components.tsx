import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";

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
      <Link href={href} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href === undefined ? href : toApiUrl(href)} {...props}>
      {children}
    </a>
  );
}
