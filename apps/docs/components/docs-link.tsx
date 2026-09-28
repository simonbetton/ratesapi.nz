"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

export function DocsLink({
  href,
  children,
  prefetch: _prefetch,
  ...props
}: ComponentProps<"a"> & { prefetch?: boolean }) {
  if (href === undefined) {
    return <a {...props}>{children}</a>;
  }

  // Fetch pages on navigation only. Repeated background prefetches can flood
  // the docs Worker, even when a visitor leaves a single page open.
  return (
    <Link {...props} href={href} prefetch={false}>
      {children}
    </Link>
  );
}
