import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import {
  extractTableOfContents,
  renderEndpoint,
  renderMarkdown,
} from "../../../../src/docs/render";
import { type DocsPageData, docsSource } from "../../../../src/docs/source";

type PageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = docsSource.getPage(slug);

  if (!page) {
    notFound();
  }

  const pageData = page.data as DocsPageData;
  const description =
    pageData.description ?? pageData.markdown.split("\n")[0] ?? "";

  return (
    <DocsPage toc={extractTableOfContents(pageData.markdown)}>
      <DocsTitle>{pageData.title}</DocsTitle>
      <DocsDescription>{description}</DocsDescription>
      <DocsBody>
        {renderEndpoint(pageData.endpoint)}
        {renderMarkdown(pageData.markdown)}
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return docsSource
    .generateParams()
    .map(({ slug }) => ({ slug: slug.length > 0 ? slug : undefined }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = docsSource.getPage(slug);

  if (!page) {
    notFound();
  }

  const pageData = page.data as DocsPageData;

  return {
    title: `${pageData.title} | Rates API`,
    description: pageData.description ?? pageData.markdown.split("\n")[0],
  };
}
