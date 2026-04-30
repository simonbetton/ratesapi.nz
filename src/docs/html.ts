import { type Root } from "fumadocs-core/page-tree";
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

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(pageData.title)} | Rates API</title>
    <meta name="description" content="${escapeAttribute(pageData.description)}" />
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
        max-width: 72rem;
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

      nav ul,
      .links {
        list-style: none;
        margin: 0;
        padding: 0;
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

      .card {
        border: 1px solid var(--border);
        border-radius: 0.875rem;
        margin: 1rem 0;
        padding: 1rem;
      }

      .card strong {
        display: block;
        font-size: 1rem;
      }

      .card span,
      li {
        color: var(--muted);
      }

      code {
        background: color-mix(in srgb, var(--muted) 12%, transparent);
        border-radius: 0.375rem;
        padding: 0.1rem 0.35rem;
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
        <p class="description">${escapeHtml(pageData.description)}</p>
        ${pageData.blocks.map(renderBlock).join("\n")}
      </main>
    </div>
  </body>
</html>`;
}

function renderNavigation(tree: Root, currentUrl: string): string {
  return `<ul>${tree.children
    .filter((node) => node.type === "page")
    .map((node) => {
      if (node.type !== "page") {
        return "";
      }

      return `<li><a href="${escapeAttribute(node.url)}"${node.url === currentUrl ? ' aria-current="page"' : ""}>${escapeHtml(String(node.name))}</a></li>`;
    })
    .join("")}</ul>`;
}

function renderBlock(block: DocsPageData["blocks"][number]): string {
  if (block.type === "paragraph") {
    return `<p>${formatInlineText(block.text)}</p>`;
  }

  if (block.type === "list") {
    return `<ul>${block.items.map((item) => `<li>${formatInlineText(item)}</li>`).join("")}</ul>`;
  }

  return `<ul class="links">${block.links
    .map(
      (link) => `<li class="card">
        <a href="${escapeAttribute(link.href)}"><strong>${escapeHtml(link.label)}</strong></a>
        <span>${escapeHtml(link.description)}</span>
      </li>`,
    )
    .join("")}</ul>`;
}

function toLlmsEntry(page: FumadocsPage): string {
  const pageData = page.data as DocsPageData;
  const body = pageData.blocks
    .map((block) => {
      if (block.type === "paragraph") {
        return block.text;
      }

      if (block.type === "list") {
        return block.items.map((item) => `- ${item}`).join("\n");
      }

      return block.links
        .map((link) => `- [${link.label}](${link.href}): ${link.description}`)
        .join("\n");
    })
    .join("\n\n");

  return `# ${pageData.title}\n\n${pageData.description}\n\n${body}`;
}

function toSlugs(pathname: string) {
  return pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(decodeURIComponent);
}

function formatInlineText(value: string): string {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
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
