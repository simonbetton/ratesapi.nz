import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { toApiUrl } from "./api-url";
import { repositoryUrl, siteOrigin } from "./site";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Rates API",
      // Relative to the /docs base path, so the title opens the docs root.
      url: "/",
    },
    githubUrl: repositoryUrl,
    links: [
      {
        type: "main",
        text: "Home",
        // The landing page is outside the /docs base path.
        url: `${siteOrigin}/`,
        // Open it in the same tab. Fumadocs opens absolute URLs in a new tab.
        external: false,
      },
      {
        type: "main",
        text: "AI integration",
        url: "/api-reference/ai-integration",
      },
      {
        type: "main",
        text: "OpenAPI",
        url: toApiUrl("/openapi"),
        external: true,
      },
    ],
    themeSwitch: {
      enabled: false,
    },
  };
}
