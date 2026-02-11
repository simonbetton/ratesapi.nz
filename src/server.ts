import { serve } from "@hono/node-server";

import app from "./index";

const port = Number(process.env.PORT ?? 8787);

serve({
  fetch: app.fetch,
  port,
});

// eslint-disable-next-line no-console
console.log(`Rates API listening on http://localhost:${port}`);
