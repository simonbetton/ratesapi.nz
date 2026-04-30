import { env } from "cloudflare:workers";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { createApp } from "./app";

const app = createApp(() => env, {
  adapter: CloudflareAdapter,
});

export { createApp };
export default app.compile();
