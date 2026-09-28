import { createFileRoute } from "@tanstack/react-router";

import { ContentPageView } from "#/components/content-page";
import { contactPage } from "#/content/contact";
import { contentPageHead } from "#/lib/page-head";

export const Route = createFileRoute("/contact")({
  head: () => contentPageHead(contactPage),
  component: ContactPage,
});

function ContactPage() {
  return <ContentPageView page={contactPage} />;
}
