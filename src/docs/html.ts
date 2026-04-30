import { FrameworkProvider, type Router } from "fumadocs-core/framework";
import { type Root } from "fumadocs-core/page-tree";
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
          links: [
            {
              type: "main",
              text: "OpenAPI",
              url: "/openapi/json",
            },
          ],
          searchToggle: { enabled: false },
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
      createElement("body", null, pageElement),
    ),
  );

  return `<!doctype html>${markup}`;
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
