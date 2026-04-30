import { type Node, type Root } from "fumadocs-core/page-tree";
import { type DocsPageData, docsSource } from "./source";

type FumadocsPage = NonNullable<ReturnType<typeof docsSource.getPage>>;

const htmlHeaders = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300",
};

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

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(pageData.title)} | Rates API</title>
    <meta name="description" content="${escapeAttribute(description)}" />
    <style>
      :root {
        color-scheme: light dark;
        --bg: #f8fafc;
        --panel: #ffffff;
        --text: #0f172a;
        --muted: #475569;
        --border: #e2e8f0;
        --accent: #2563eb;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #020617;
          --panel: #0f172a;
          --text: #e2e8f0;
          --muted: #94a3b8;
          --border: #1e293b;
          --accent: #60a5fa;
        }
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
        line-height: 1.6;
      }

      a {
        color: var(--accent);
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      .shell {
        display: grid;
        gap: 2rem;
        grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr);
        margin: 0 auto;
        max-width: 86rem;
        padding: 2rem;
      }

      nav,
      main {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 1rem;
      }

      nav {
        align-self: start;
        padding: 1rem;
        position: sticky;
        top: 2rem;
      }

      nav h2 {
        font-size: 0.875rem;
        letter-spacing: 0.08em;
        margin: 0 0 1rem;
        text-transform: uppercase;
      }

      nav ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      nav ul ul {
        border-left: 1px solid var(--border);
        margin-left: 0.75rem;
        padding-left: 0.5rem;
      }

      nav a {
        border-radius: 0.5rem;
        color: var(--muted);
        display: block;
        padding: 0.5rem 0.75rem;
      }

      nav a[aria-current="page"] {
        background: color-mix(in srgb, var(--accent) 12%, transparent);
        color: var(--accent);
        font-weight: 700;
      }

      .section-label {
        color: var(--text);
        display: block;
        font-size: 0.8rem;
        font-weight: 700;
        margin: 0.75rem 0 0.25rem;
        padding: 0.25rem 0.75rem;
      }

      main {
        padding: clamp(1.5rem, 4vw, 3rem);
      }

      h1 {
        font-size: clamp(2rem, 5vw, 4rem);
        line-height: 1;
        margin: 0;
      }

      .description {
        color: var(--muted);
        font-size: 1.125rem;
        margin: 1rem 0 2rem;
        max-width: 42rem;
      }

      .endpoint {
        background: color-mix(in srgb, var(--accent) 8%, transparent);
        border: 1px solid var(--border);
        border-radius: 0.875rem;
        margin: 0 0 2rem;
        padding: 1rem 1.25rem;
      }

      .method {
        background: var(--accent);
        border-radius: 999px;
        color: white;
        display: inline-block;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        margin-right: 0.5rem;
        padding: 0.2rem 0.55rem;
      }

      li {
        color: var(--muted);
      }

      h2,
      h3,
      h4 {
        line-height: 1.2;
        margin: 2rem 0 0.75rem;
      }

      table {
        border-collapse: collapse;
        display: block;
        margin: 1rem 0;
        overflow-x: auto;
        width: 100%;
      }

      th,
      td {
        border: 1px solid var(--border);
        padding: 0.65rem 0.75rem;
        text-align: left;
      }

      th {
        background: color-mix(in srgb, var(--muted) 10%, transparent);
        color: var(--text);
      }

      pre {
        background: #0f172a;
        border-radius: 0.875rem;
        color: #e2e8f0;
        overflow-x: auto;
        padding: 1rem;
      }

      code {
        background: color-mix(in srgb, var(--muted) 12%, transparent);
        border-radius: 0.375rem;
        padding: 0.1rem 0.35rem;
      }

      pre code {
        background: transparent;
        padding: 0;
      }

      @media (max-width: 760px) {
        .shell {
          grid-template-columns: 1fr;
          padding: 1rem;
        }

        nav {
          position: static;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <nav aria-label="Documentation">
        <h2>${escapeHtml(String(tree.name))}</h2>
        ${renderNavigation(tree, page.url)}
      </nav>
      <main>
        <h1>${escapeHtml(pageData.title)}</h1>
        ${description ? `<p class="description">${formatInlineText(description)}</p>` : ""}
        ${renderEndpoint(pageData.endpoint)}
        ${renderMarkdown(pageData.markdown)}
      </main>
    </div>
  </body>
</html>`;
}

function renderNavigation(tree: Root, currentUrl: string): string {
  return `<ul>${tree.children.map((node) => renderNavigationNode(node, currentUrl)).join("")}</ul>`;
}

function renderNavigationNode(node: Node, currentUrl: string): string {
  if (node.type === "separator") {
    return node.name
      ? `<li><span class="section-label">${escapeHtml(String(node.name))}</span></li>`
      : "";
  }

  if (node.type === "folder") {
    return `<li><span class="section-label">${escapeHtml(String(node.name))}</span><ul>${node.children
      .map((child) => renderNavigationNode(child, currentUrl))
      .join("")}</ul></li>`;
  }

  return `<li><a href="${escapeAttribute(node.url)}"${node.url === currentUrl ? ' aria-current="page"' : ""}>${escapeHtml(String(node.name))}</a></li>`;
}

function renderEndpoint(endpoint: DocsPageData["endpoint"]): string {
  if (!endpoint) {
    return "";
  }

  return `<section class="endpoint" aria-label="Endpoint summary">
    <p><span class="method">${endpoint.method}</span><code>${escapeHtml(endpoint.path)}</code></p>
    <p><strong>Operation:</strong> <code>${escapeHtml(endpoint.operationId)}</code></p>
    ${endpoint.parameters ? `<p><strong>Parameters:</strong></p><ul>${endpoint.parameters.map((parameter) => `<li>${formatInlineText(parameter)}</li>`).join("")}</ul>` : ""}
    <p><strong>Responses:</strong></p>
    <ul>${endpoint.responses.map((response) => `<li>${formatInlineText(response)}</li>`).join("")}</ul>
  </section>`;
}

function renderMarkdown(markdown: string): string {
  const blocks: string[] = [];
  const lines = markdown.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const block = readMarkdownBlock(lines, index);

    if (!block) {
      continue;
    }

    blocks.push(block.html);
    index = block.nextIndex;
  }

  return blocks.join("\n");
}

type MarkdownBlock = {
  html: string;
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
    return {
      html: `<h${level}>${formatInlineText(heading[2] ?? "")}</h${level}>`,
      nextIndex: index,
    };
  }

  return {
    html: `<p>${formatInlineText(line)}</p>`,
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
    html: `<pre><code${language ? ` data-language="${escapeAttribute(language)}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`,
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
    html: `<${tagName}>${items.map((item) => `<li>${formatInlineText(item)}</li>`).join("")}</${tagName}>`,
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

function formatInlineText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => {
      return `<a href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
    })
    .split(/(<a [^>]+>.*?<\/a>)/g)
    .map((part) => (part.startsWith("<a ") ? part : escapeHtml(part)))
    .join("")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderTable(lines: string[]): string {
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
    return "";
  }

  return `<table><thead><tr>${header
    .map((cell) => `<th>${formatInlineText(cell)}</th>`)
    .join("")}</tr></thead><tbody>${body
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${formatInlineText(cell)}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody></table>`;
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
