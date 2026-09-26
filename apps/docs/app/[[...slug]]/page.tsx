import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { openGraphDefaults, twitterDefaults } from "@/lib/metadata";
import { toDocsUrl } from "@/lib/site";
import { source } from "@/lib/source";
import { getDocsJsonLd } from "@/lib/structured-data";
import { ApiLink } from "@/mdx-components";

// Each docs page is prerendered at build time, and OpenNext serves the
// prerendered HTML. Do not set `dynamicParams = false`: OpenNext compares
// the request path, with the /docs base path, to the prerendered paths,
// without it. Then all pages return 404.
export const dynamic = "force-static";

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

const lastUpdatedFormat = new Intl.DateTimeFormat("en-NZ", {
  dateStyle: "long",
  timeZone: "Pacific/Auckland",
});

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = source.getPage(slug);

  if (!page) {
    notFound();
  }

  const MDXContent = page.data.body;
  const { lastModified } = page.data;

  return (
    <DocsPage toc={page.data.toc}>
      <script
        type="application/ld+json"
        // oxlint-disable-next-line react/no-danger -- JSON-LD must be inline, and getDocsJsonLd escapes "<".
        dangerouslySetInnerHTML={{ __html: getDocsJsonLd(page) }}
      />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent components={{ a: ApiLink }} />
      </DocsBody>
      {lastModified ? (
        <p className="text-fd-muted-foreground text-sm">
          Last updated on{" "}
          <time dateTime={lastModified.toISOString()}>
            {lastUpdatedFormat.format(lastModified)}
          </time>
        </p>
      ) : null}
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source
    .generateParams()
    .map(({ slug }) => ({ slug: slug.length > 0 ? slug : undefined }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);

  if (!page) {
    notFound();
  }

  // The root layout adds " | Rates API" to the <title>.
  const title = page.data.seoTitle ?? page.data.title;
  const { description } = page.data;
  const url = toDocsUrl(page.url);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      ...openGraphDefaults,
      type: "article",
      title,
      description,
      url,
      ...(page.data.lastModified
        ? { modifiedTime: page.data.lastModified.toISOString() }
        : {}),
    },
    twitter: {
      ...twitterDefaults,
      title,
      description,
    },
  };
}
