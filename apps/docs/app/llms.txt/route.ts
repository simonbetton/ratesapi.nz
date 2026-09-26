import { renderLlmsIndex } from "@/lib/llms";
import { getNavPages } from "@/lib/source";

// The build makes this file one time.
export const dynamic = "force-static";

export function GET() {
  return new Response(renderLlmsIndex(getNavPages()), {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
