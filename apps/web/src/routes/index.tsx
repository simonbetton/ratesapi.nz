import { createFileRoute } from "@tanstack/react-router";

import { Page } from "#/components/composition";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Page />;
}
