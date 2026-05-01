import { docsLlms } from "@/lib/source";

export function GET() {
  return new Response(docsLlms.index(), {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
