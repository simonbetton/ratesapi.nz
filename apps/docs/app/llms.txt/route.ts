import { docsLlms } from "@/lib/source";

export async function GET() {
  return new Response(await docsLlms.index(), {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
