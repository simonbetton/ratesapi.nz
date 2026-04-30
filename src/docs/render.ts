import { type TOCItemType } from "fumadocs-core/toc";
import { createElement, Fragment, type ReactNode } from "react";
import { type DocsPageData } from "./source";

type FumadocsPage = {
  data: DocsPageData;
};

export function renderEndpoint(endpoint: DocsPageData["endpoint"]): ReactNode {
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

export function renderMarkdown(markdown: string): ReactNode[] {
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

export function toLlmsEntry(page: FumadocsPage): string {
  const pageData = page.data;
  const description = pageData.description ? `\n\n${pageData.description}` : "";

  return `# ${pageData.title}${description}\n\n${pageData.markdown}`;
}

export function extractTableOfContents(markdown: string): TOCItemType[] {
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

function renderTable(lines: string[]): ReactNode {
  const [headerLine, separatorLine, ...bodyLines] = lines;
  const headers = splitTableRow(headerLine ?? "");
  const separator = splitTableRow(separatorLine ?? "");

  if (headers.length === 0 || separator.length === 0) {
    return createElement("p", { key: lines.join("\n") }, lines.join(" "));
  }

  return createElement(
    "table",
    { key: headerLine },
    createElement(
      "thead",
      null,
      createElement(
        "tr",
        null,
        headers.map((header) =>
          createElement("th", { key: header }, renderInlineText(header)),
        ),
      ),
    ),
    createElement(
      "tbody",
      null,
      bodyLines.map((line) => {
        const cells = splitTableRow(line);

        return createElement(
          "tr",
          { key: line },
          cells.map((cell, index) =>
            createElement(
              "td",
              { key: `${line}-${index}` },
              renderInlineText(cell),
            ),
          ),
        );
      }),
    ),
  );
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
}

function renderInlineText(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const token = match[0];
    const index = match.index ?? 0;

    if (index > cursor) {
      nodes.push(value.slice(cursor, index));
    }

    if (token.startsWith("`")) {
      nodes.push(
        createElement("code", { key: `${index}-${token}` }, token.slice(1, -1)),
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        nodes.push(
          createElement(
            "a",
            { href: link[2], key: `${index}-${token}` },
            link[1],
          ),
        );
      }
    }

    cursor = index + token.length;
  }

  if (cursor < value.length) {
    nodes.push(value.slice(cursor));
  }

  return nodes.length > 0 ? nodes : [value];
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function toHeadingId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
