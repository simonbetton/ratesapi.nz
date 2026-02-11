import { ConvexHttpClient } from "convex/browser";

function getConvexUrl(): string {
  const convexUrl = process.env.CONVEX_URL;

  if (!convexUrl) {
    throw new Error(
      "CONVEX_URL is required. Run `bun run dev` (starts Convex + API) or set CONVEX_URL in your environment.",
    );
  }

  return convexUrl;
}

export function createConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(getConvexUrl());
}
