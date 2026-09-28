import { createFileRoute } from "@tanstack/react-router";

import { ContentPageView } from "#/components/content-page";
import { privacyPage } from "#/content/privacy";
import { contentPageHead } from "#/lib/page-head";

export const Route = createFileRoute("/privacy")({
  head: () => contentPageHead(privacyPage),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <ContentPageView page={privacyPage} />;
}
