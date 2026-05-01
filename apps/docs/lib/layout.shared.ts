import { type BaseLayoutProps } from "fumadocs-ui/layouts/shared";

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
        text: "AI-ready",
        url: "/api-reference/ai-integration",
      },
      {
        type: "main",
        text: "OpenAPI",
        url: "/openapi",
      },
    ],
    themeSwitch: {
      enabled: false,
    },
  };
}
