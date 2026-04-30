import { FrameworkProvider, type Router } from "fumadocs-core/framework";
import { type Root } from "fumadocs-core/page-tree";
import { createSearchAPI } from "fumadocs-core/search/server";
import { type TOCItemType } from "fumadocs-core/toc";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import fumadocsUiPackage from "fumadocs-ui/package.json";
import { RootProvider } from "fumadocs-ui/provider/base";
import {
  type ComponentType,
  createElement,
  Fragment,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type DocsPageData, docsSource } from "./source";

type FumadocsPage = NonNullable<ReturnType<typeof docsSource.getPage>>;
type StaticFrameworkProviderProps = {
  usePathname: () => string;
  useParams: () => Record<string, string | string[]>;
  useRouter: () => Router;
  children?: ReactNode;
};
const FumadocsFrameworkProvider =
  FrameworkProvider as unknown as ComponentType<StaticFrameworkProviderProps>;

const htmlHeaders = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300",
};
const fumadocsUiStylesheet = `https://cdn.jsdelivr.net/npm/fumadocs-ui@${fumadocsUiPackage.version}/dist/style.css`;
const searchButtonClassName =
  "inline-flex items-center justify-center rounded-md p-2 text-sm font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring hover:bg-fd-accent hover:text-fd-accent-foreground";
const fullSearchButtonClassName =
  "inline-flex items-center gap-2 rounded-lg border bg-fd-secondary/50 p-1.5 ps-2 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground";
const docsSearchApi = createSearchAPI("simple", {
  language: "english",
  indexes: docsSource.getPages().map((page) => {
    const pageData = page.data as DocsPageData;

    return {
      title: pageData.title,
      description: pageData.description,
      breadcrumbs: page.slugs,
      content: [
        pageData.title,
        pageData.description,
        pageData.endpoint?.path,
        pageData.endpoint?.operationId,
        pageData.markdown,
      ]
        .filter((value): value is string => typeof value === "string")
        .join("\n\n"),
      url: page.url,
    };
  }),
});
const docsLayoutOverrides = `
  .endpoint-summary {
    margin-bottom: 2rem;
    border-radius: 0.75rem;
    border: 1px solid var(--color-fd-border);
    background: var(--color-fd-card);
    padding: 1rem;
  }

  .endpoint-summary p {
    margin: 0.5rem 0;
  }

  .endpoint-method {
    display: inline-block;
    margin-right: 0.5rem;
    border-radius: 999px;
    background: var(--color-fd-primary);
    color: var(--color-fd-primary-foreground);
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  #rates-mobile-sidebar,
  #rates-docs-search {
    position: fixed;
    inset: 0;
    z-index: 60;
    pointer-events: none;
  }

  #rates-mobile-sidebar {
    display: none;
  }

  #rates-mobile-sidebar[data-open="true"],
  #rates-docs-search[data-open="true"] {
    pointer-events: auto;
  }

  [data-mobile-sidebar-overlay],
  [data-docs-search-overlay] {
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 0.35);
    opacity: 0;
    transition: opacity 150ms ease;
  }

  #rates-mobile-sidebar[data-open="true"] [data-mobile-sidebar-overlay],
  #rates-docs-search[data-open="true"] [data-docs-search-overlay] {
    opacity: 1;
  }

  [data-mobile-sidebar-panel] {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    display: flex;
    width: min(85vw, 380px);
    transform: translateX(100%);
    flex-direction: column;
    overflow: auto;
    border-inline-start: 1px solid var(--color-fd-border);
    background: var(--color-fd-background);
    color: var(--color-fd-foreground);
    box-shadow: var(--shadow-lg);
    transition: transform 150ms ease;
  }

  #rates-mobile-sidebar[data-open="true"] [data-mobile-sidebar-panel] {
    transform: translateX(0);
  }

  [data-mobile-sidebar-header],
  [data-docs-search-header] {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid var(--color-fd-border);
    padding: 1rem;
  }

  [data-mobile-sidebar-content] > * {
    width: 100%;
  }

  [data-docs-search-dialog] {
    position: relative;
    margin: 10vh auto 0;
    display: flex;
    width: min(92vw, 42rem);
    max-height: min(70vh, 36rem);
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--color-fd-border);
    border-radius: 0.75rem;
    background: var(--color-fd-popover, var(--color-fd-background));
    color: var(--color-fd-popover-foreground, var(--color-fd-foreground));
    box-shadow: var(--shadow-lg);
    opacity: 0;
    transform: translateY(-0.5rem);
    transition:
      opacity 150ms ease,
      transform 150ms ease;
  }

  #rates-docs-search[data-open="true"] [data-docs-search-dialog] {
    opacity: 1;
    transform: translateY(0);
  }

  [data-docs-search-input] {
    min-width: 0;
    flex: 1;
    background: transparent;
    font-size: 1rem;
    outline: none;
  }

  [data-docs-search-results] {
    overflow: auto;
    padding: 0.5rem;
  }

  [data-docs-search-item] {
    display: block;
    border-radius: 0.5rem;
    padding: 0.75rem;
    text-decoration: none;
  }

  [data-docs-search-item]:hover,
  [data-docs-search-item]:focus {
    background: var(--color-fd-accent);
    color: var(--color-fd-accent-foreground);
    outline: none;
  }

  [data-docs-search-item-title] {
    display: block;
    font-weight: 600;
  }

  [data-docs-search-item-url],
  [data-docs-search-empty] {
    color: var(--color-fd-muted-foreground);
    font-size: 0.875rem;
  }

  [data-docs-search-item-snippet] {
    margin-top: 0.25rem;
    color: var(--color-fd-muted-foreground);
    font-size: 0.875rem;
  }

  [data-docs-search-item] mark {
    color: var(--color-fd-primary);
    text-decoration: underline;
    background: transparent;
  }

  [data-docs-search-item-breadcrumbs] {
    display: inline-flex;
    gap: 0.25rem;
    color: var(--color-fd-muted-foreground);
    font-size: 0.75rem;
  }

  [data-docs-search-item-type] {
    color: var(--color-fd-muted-foreground);
    font-size: 0.75rem;
  }

  @media (max-width: 767px) {
    #rates-mobile-sidebar {
      display: block;
    }
  }
`;

export function renderDocsRoute(pathname: string): Response | undefined {
  const slugs = toSlugs(pathname);
  const page = docsSource.getPage(slugs);

  if (!page) {
    return undefined;
  }

  return new Response(renderDocsHtml(page, docsSource.getPageTree()), {
    headers: htmlHeaders,
  });
}

export function renderLlmsTxt(): Response {
  return new Response(docsSource.getPages().map(toLlmsEntry).join("\n\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

export function renderDocsSearch(request: Request): Promise<Response> {
  return docsSearchApi.GET(request);
}

function renderDocsHtml(page: FumadocsPage, tree: Root): string {
  const pageData = page.data as DocsPageData;
  const description =
    pageData.description ?? pageData.markdown.split("\n")[0] ?? "";
  const router: Router = {
    push() {},
    refresh() {},
  };
  const pageElement = createElement(
    FumadocsFrameworkProvider,
    {
      usePathname: () => page.url,
      useParams: () => ({}),
      useRouter: () => router,
    },
    createElement(
      RootProvider,
      {
        search: { enabled: false },
        theme: { enabled: false },
      },
      createElement(
        DocsLayout,
        {
          tree,
          nav: {
            title: "Rates API",
            url: "/",
          },
          githubUrl: "https://github.com/simonbetton/ratesapi.nz",
          sidebar: {
            defaultOpenLevel: 3,
          },
          slots: {
            searchTrigger: {
              sm: SearchTriggerButton,
              full: FullSearchTriggerButton,
            },
          },
          links: [
            {
              type: "main",
              text: "OpenAPI",
              url: "/openapi/json",
            },
          ],
          themeSwitch: { enabled: false },
        },
        createElement(
          DocsPage,
          {
            toc: extractTableOfContents(pageData.markdown),
          },
          createElement(DocsTitle, null, pageData.title),
          createElement(DocsDescription, null, description),
          createElement(
            DocsBody,
            null,
            renderEndpoint(pageData.endpoint),
            ...renderMarkdown(pageData.markdown),
          ),
        ),
      ),
    ),
  );

  const markup = renderToStaticMarkup(
    createElement(
      "html",
      { lang: "en" },
      createElement(
        "head",
        null,
        createElement("meta", { charSet: "utf-8" }),
        createElement("meta", {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
        createElement("title", null, `${pageData.title} | Rates API`),
        createElement("meta", {
          name: "description",
          content: description,
        }),
        createElement("link", {
          rel: "stylesheet",
          href: fumadocsUiStylesheet,
        }),
        createElement("style", null, docsLayoutOverrides),
      ),
      createElement(
        "body",
        null,
        pageElement,
        renderMobileSidebarShell(),
        renderSearchDialogShell(),
        createElement("script", {
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static enhancement script for server-rendered docs interactivity.
          dangerouslySetInnerHTML: {
            __html: getDocsEnhancementScript(),
          },
        }),
      ),
    ),
  );

  return `<!doctype html>${markup}`;
}

function SearchTriggerButton(): ReactNode {
  return createElement(
    "button",
    {
      type: "button",
      className: `${searchButtonClassName} p-2`,
      "data-docs-search-open": "",
      "aria-label": "Open Search",
    },
    "Search",
  );
}

function FullSearchTriggerButton(): ReactNode {
  return createElement(
    "button",
    {
      type: "button",
      className: fullSearchButtonClassName,
      "data-docs-search-open": "",
      "aria-label": "Search documentation",
    },
    createElement("span", null, "Search"),
    createElement(
      "span",
      { className: "ms-auto inline-flex gap-0.5" },
      createElement(
        "kbd",
        { className: "rounded-md border bg-fd-background px-1.5" },
        "Ctrl",
      ),
      createElement(
        "kbd",
        { className: "rounded-md border bg-fd-background px-1.5" },
        "K",
      ),
    ),
  );
}

function renderMobileSidebarShell(): ReactNode {
  return createElement(
    "div",
    {
      id: "rates-mobile-sidebar",
      "data-open": "false",
      "aria-hidden": "true",
    },
    createElement("div", { "data-mobile-sidebar-overlay": "" }),
    createElement(
      "aside",
      {
        "data-mobile-sidebar-panel": "",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Documentation navigation",
      },
      createElement(
        "div",
        { "data-mobile-sidebar-header": "" },
        createElement("strong", null, "Rates API"),
        createElement("span", { style: { flex: 1 } }),
        createElement(
          "button",
          {
            type: "button",
            className: searchButtonClassName,
            "data-mobile-sidebar-close": "",
          },
          "Close",
        ),
      ),
      createElement("div", { "data-mobile-sidebar-content": "" }),
    ),
  );
}

function renderSearchDialogShell(): ReactNode {
  return createElement(
    "div",
    {
      id: "rates-docs-search",
      "data-open": "false",
      "aria-hidden": "true",
    },
    createElement("div", { "data-docs-search-overlay": "" }),
    createElement(
      "div",
      {
        "data-docs-search-dialog": "",
        "data-fumadocs-search-ui": "",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Search documentation",
      },
      createElement(
        "div",
        { "data-docs-search-header": "" },
        createElement("input", {
          type: "search",
          placeholder: "Search documentation...",
          "aria-label": "Search documentation",
          "data-docs-search-input": "",
        }),
        createElement(
          "button",
          {
            type: "button",
            className: searchButtonClassName,
            "data-docs-search-close": "",
          },
          "Close",
        ),
      ),
      createElement("div", { "data-docs-search-results": "" }),
    ),
  );
}

function getDocsEnhancementScript(): string {
  return `
(() => {
  const sidebar = document.getElementById("rates-mobile-sidebar");
  const sidebarContent = sidebar?.querySelector("[data-mobile-sidebar-content]");
  const sidebarSource = document.getElementById("nd-sidebar");
  const search = document.getElementById("rates-docs-search");
  const searchInput = search?.querySelector("[data-docs-search-input]");
  const searchResults = search?.querySelector("[data-docs-search-results]");
  let searchAbort;

  function setDialogState(element, isOpen) {
    if (!element) return;
    element.dataset.open = String(isOpen);
    element.setAttribute("aria-hidden", String(!isOpen));
    document.documentElement.style.overflow = isOpen ? "hidden" : "";
  }

  function openSidebar() {
    if (sidebarContent && sidebarSource && sidebarContent.childElementCount === 0) {
      sidebarContent.append(...Array.from(sidebarSource.children).map((child) => child.cloneNode(true)));
    }
    setDialogState(sidebar, true);
  }

  function closeSidebar() {
    setDialogState(sidebar, false);
  }

  function openSearch() {
    setDialogState(search, true);
    window.setTimeout(() => searchInput?.focus(), 0);
    if (searchResults && searchResults.childElementCount === 0) {
      renderSearchResults([]);
    }
  }

  function closeSearch() {
    setDialogState(search, false);
  }

  function sanitizeSearchHtml(value) {
    return value.replace(/<(?!\\/?mark\\b)[^>]*>/g, "").replace(/[&<>"']/g, (character) => {
      if (character === "<" || character === ">") {
        return character;
      }

      return ({
      "&": "&amp;",
      '"': "&quot;",
      "'": "&#39;",
      })[character];
    });
  }

  function escapeAttribute(value) {
    return value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function renderSearchResults(items, isLoading = false) {
    if (!searchResults) return;
    if (isLoading) {
      searchResults.innerHTML = '<p data-docs-search-empty>Searching...</p>';
      return;
    }
    if (items.length === 0) {
      searchResults.innerHTML = '<p data-docs-search-empty>Start typing to search the documentation.</p>';
      return;
    }
    searchResults.innerHTML = items.map((item) => {
      const breadcrumbs = Array.isArray(item.breadcrumbs) && item.breadcrumbs.length > 0
        ? '<div data-docs-search-item-breadcrumbs>' + item.breadcrumbs.map(sanitizeSearchHtml).join(" › ") + '</div>'
        : '';
      const itemType = item.type && item.type !== "page"
        ? '<span data-docs-search-item-type>' + escapeAttribute(item.type) + '</span>'
        : '';
      return '<a data-docs-search-item href="' + escapeAttribute(item.url) + '">' +
        breadcrumbs +
        itemType +
        '<div data-docs-search-item-title>' + sanitizeSearchHtml(item.content) + '</div>' +
        '</a>';
    }).join("");
  }

  async function runSearch(query) {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      renderSearchResults([]);
      return;
    }
    searchAbort?.abort();
    searchAbort = new AbortController();
    renderSearchResults([], true);
    try {
      const response = await fetch("/api/search?query=" + encodeURIComponent(trimmedQuery), {
        signal: searchAbort.signal,
      });
      if (!response.ok) throw new Error(await response.text());
      renderSearchResults(await response.json());
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (searchResults) {
        searchResults.innerHTML = '<p data-docs-search-empty>Search failed. Please try again.</p>';
      }
    }
  }

  let searchTimer;
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('button[aria-label="Open Sidebar"]')) {
      event.preventDefault();
      openSidebar();
    } else if (target.closest("[data-mobile-sidebar-close], [data-mobile-sidebar-overlay]")) {
      closeSidebar();
    } else if (target.closest("[data-docs-search-open], [data-search], [data-search-full]")) {
      event.preventDefault();
      openSearch();
    } else if (target.closest("[data-docs-search-close], [data-docs-search-overlay]")) {
      closeSearch();
    }
  });

  searchInput?.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => runSearch(searchInput.value), 150);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebar();
      closeSearch();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
  });
})();
`;
}

function renderEndpoint(endpoint: DocsPageData["endpoint"]): ReactNode {
  if (!endpoint) {
    return null;
  }

  return createElement(
    "section",
    {
      className: "endpoint-summary",
      "aria-label": "Endpoint summary",
    },
    createElement(
      "p",
      null,
      createElement("span", { className: "endpoint-method" }, endpoint.method),
      createElement("code", null, endpoint.path),
    ),
    createElement(
      "p",
      null,
      createElement("strong", null, "Operation:"),
      " ",
      createElement("code", null, endpoint.operationId),
    ),
    endpoint.parameters
      ? createElement(
          Fragment,
          null,
          createElement(
            "p",
            null,
            createElement("strong", null, "Parameters:"),
          ),
          createElement(
            "ul",
            null,
            endpoint.parameters.map((parameter) =>
              createElement(
                "li",
                { key: parameter },
                renderInlineText(parameter),
              ),
            ),
          ),
        )
      : null,
    createElement("p", null, createElement("strong", null, "Responses:")),
    createElement(
      "ul",
      null,
      endpoint.responses.map((response) =>
        createElement("li", { key: response }, renderInlineText(response)),
      ),
    ),
  );
}

function renderMarkdown(markdown: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const lines = markdown.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const block = readMarkdownBlock(lines, index);

    if (!block) {
      continue;
    }

    blocks.push(block.html);
    index = block.nextIndex;
  }

  return blocks;
}

type MarkdownBlock = {
  html: ReactNode;
  nextIndex: number;
};

function readMarkdownBlock(
  lines: string[],
  index: number,
): MarkdownBlock | undefined {
  const line = lines[index] ?? "";

  if (line.trim().length === 0) {
    return undefined;
  }

  if (line.startsWith("```")) {
    return readCodeBlock(lines, index);
  }

  if (line.startsWith("|")) {
    return readTableBlock(lines, index);
  }

  if (line.startsWith("- ")) {
    return readListBlock(lines, index, "ul", (value) => value.startsWith("- "));
  }

  if (/^\d+\. /.test(line)) {
    return readListBlock(lines, index, "ol", (value) => /^\d+\. /.test(value));
  }

  const heading = /^(#{2,4})\s+(.+)$/.exec(line);
  if (heading) {
    const level = heading[1]?.length ?? 2;
    const title = stripInlineMarkdown(heading[2] ?? "");
    return {
      html: createElement(
        `h${level}`,
        { id: toHeadingId(title), key: `${index}-${title}` },
        renderInlineText(heading[2] ?? ""),
      ),
      nextIndex: index,
    };
  }

  return {
    html: createElement("p", { key: index }, renderInlineText(line)),
    nextIndex: index,
  };
}

function readCodeBlock(lines: string[], index: number): MarkdownBlock {
  const language = (lines[index] ?? "").slice(3).trim();
  const code: string[] = [];
  let nextIndex = index + 1;

  while (
    nextIndex < lines.length &&
    !(lines[nextIndex] ?? "").startsWith("```")
  ) {
    code.push(lines[nextIndex] ?? "");
    nextIndex += 1;
  }

  return {
    html: createElement(
      "pre",
      { key: index },
      createElement(
        "code",
        language ? { "data-language": language } : null,
        code.join("\n"),
      ),
    ),
    nextIndex,
  };
}

function readTableBlock(lines: string[], index: number): MarkdownBlock {
  const tableLines = [lines[index] ?? ""];
  let nextIndex = index;

  while (
    nextIndex + 1 < lines.length &&
    (lines[nextIndex + 1] ?? "").startsWith("|")
  ) {
    nextIndex += 1;
    tableLines.push(lines[nextIndex] ?? "");
  }

  return {
    html: renderTable(tableLines),
    nextIndex,
  };
}

function readListBlock(
  lines: string[],
  index: number,
  tagName: "ol" | "ul",
  isListItem: (value: string) => boolean,
): MarkdownBlock {
  const items = [toListItemText(lines[index] ?? "")];
  let nextIndex = index;

  while (
    nextIndex + 1 < lines.length &&
    isListItem(lines[nextIndex + 1] ?? "")
  ) {
    nextIndex += 1;
    items.push(toListItemText(lines[nextIndex] ?? ""));
  }

  return {
    html: createElement(
      tagName,
      { key: index },
      items.map((item) =>
        createElement("li", { key: item }, renderInlineText(item)),
      ),
    ),
    nextIndex,
  };
}

function toListItemText(value: string): string {
  return value.replace(/^(-|\d+\.) /, "");
}

function toLlmsEntry(page: FumadocsPage): string {
  const pageData = page.data as DocsPageData;
  const description = pageData.description ? `\n\n${pageData.description}` : "";

  return `# ${pageData.title}${description}\n\n${pageData.markdown}`;
}

function toSlugs(pathname: string) {
  return pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(decodeURIComponent);
}

function extractTableOfContents(markdown: string): TOCItemType[] {
  return markdown.split("\n").flatMap((line): TOCItemType[] => {
    const heading = /^(#{2,4})\s+(.+)$/.exec(line);

    if (!heading) {
      return [];
    }

    const depth = heading[1]?.length ?? 2;
    const title = stripInlineMarkdown(heading[2] ?? "");

    return [
      {
        title,
        url: `#${toHeadingId(title)}`,
        depth,
      },
    ];
  });
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function toHeadingId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function renderInlineText(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`)/g;
  let lastIndex = 0;

  for (const match of value.matchAll(pattern)) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index));
    }

    const linkLabel = match[2];
    const linkHref = match[3];
    const code = match[4];

    if (linkLabel && linkHref) {
      nodes.push(
        createElement(
          "a",
          { href: linkHref, key: `${match.index}-link` },
          linkLabel,
        ),
      );
    } else if (code) {
      nodes.push(createElement("code", { key: `${match.index}-code` }, code));
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes;
}

function renderTable(lines: string[]): ReactNode {
  const rows = lines
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  const [header, ...body] = rows;

  if (!header) {
    return null;
  }

  return createElement(
    "table",
    { key: lines.join("\n") },
    createElement(
      "thead",
      null,
      createElement(
        "tr",
        null,
        header.map((cell) =>
          createElement("th", { key: cell }, renderInlineText(cell)),
        ),
      ),
    ),
    createElement(
      "tbody",
      null,
      body.map((row, rowIndex) =>
        createElement(
          "tr",
          { key: rowIndex },
          row.map((cell, cellIndex) =>
            createElement(
              "td",
              { key: `${rowIndex}-${cellIndex}` },
              renderInlineText(cell),
            ),
          ),
        ),
      ),
    ),
  );
}
