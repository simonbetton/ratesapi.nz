import { siteName, siteOrigin, socialImage, toDocsUrl } from "./site";
import { isHubPage, source } from "./source";
import type { DocsPage } from "./source";

// The landing page defines these nodes in full. The docs pages repeat the
// main fields with the same @id values, so each page is complete alone.
const websiteId = `${siteOrigin}/#website`;
const publisherId = `${siteOrigin}/#publisher`;
const apiId = `${siteOrigin}/#api`;

interface Breadcrumb {
  name: string;
  url: string;
}

// Home, then the docs root, then each section index above the page.
export function getBreadcrumbs(page: DocsPage): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [{ name: siteName, url: `${siteOrigin}/` }];

  for (let depth = 0; depth <= page.slugs.length; depth += 1) {
    const ancestor = source.getPage(page.slugs.slice(0, depth));

    if (ancestor) {
      breadcrumbs.push({
        name: depth === 0 ? "Docs" : ancestor.data.title,
        url: toDocsUrl(ancestor.url),
      });
    }
  }

  return breadcrumbs;
}

// Section index pages are CollectionPage items. All other pages are
// TechArticle items.
export function getDocsJsonLd(page: DocsPage): string {
  const url = toDocsUrl(page.url);
  const name = page.data.seoTitle ?? page.data.title;
  const breadcrumbId = `${url}#breadcrumb`;
  const shared = {
    description: page.data.description,
    url,
    inLanguage: "en-NZ",
    isPartOf: { "@id": websiteId },
    about: { "@id": apiId },
    breadcrumb: { "@id": breadcrumbId },
    ...(page.data.lastModified
      ? { dateModified: page.data.lastModified.toISOString() }
      : {}),
  };
  const pageNode = isHubPage(page)
    ? { "@type": "CollectionPage", "@id": `${url}#webpage`, name, ...shared }
    : {
        "@type": "TechArticle",
        "@id": `${url}#article`,
        headline: name,
        image: socialImage.url,
        author: { "@id": publisherId },
        publisher: { "@id": publisherId },
        ...shared,
      };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      pageNode,
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: getBreadcrumbs(page).map((breadcrumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: breadcrumb.name,
          item: breadcrumb.url,
        })),
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: `${siteOrigin}/`,
        name: siteName,
        publisher: { "@id": publisherId },
      },
      {
        "@type": "Person",
        "@id": publisherId,
        name: "Simon Betton",
        url: "https://www.simonbetton.com",
      },
    ],
  };

  // Escape "<" so that the content cannot close the <script> element.
  return JSON.stringify(jsonLd).replaceAll("<", "\\u003c");
}
