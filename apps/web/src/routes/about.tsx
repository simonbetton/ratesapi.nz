import { createFileRoute } from "@tanstack/react-router";

import { ContentPageView } from "#/components/content-page";
import { aboutPage } from "#/content/about";
import { contentPageHead } from "#/lib/page-head";

export const Route = createFileRoute("/about")({
  head: () => contentPageHead(aboutPage),
  component: AboutPage,
});

function AboutPage() {
  return <ContentPageView page={aboutPage} />;
}
