import { renderLlmsFull } from "@/lib/llms";
import { getNavPages } from "@/lib/source";

// The build makes this file one time.
export const dynamic = "force-static";

export async function GET() {
  const pages = await Promise.all(
    getNavPages().map(async (page) => ({
      page,
      markdown: await page.data.getText("processed"),
    }))
  );

  return new Response(renderLlmsFull(pages), {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
