import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { source } from "@/lib/source";

type PageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = source.getPage(slug);

  if (!page) {
    notFound();
  }

  const MDXContent = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent />
      </DocsBody>
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

  return {
    title: `${page.data.title} | Rates API`,
    description: page.data.description,
  };
}
