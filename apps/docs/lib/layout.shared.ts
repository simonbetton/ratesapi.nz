import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { toApiUrl } from "./api-url";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Rates API",
      url: "/",
    },
    githubUrl: "https://github.com/simonbetton/ratesapi.nz",
    links: [
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
