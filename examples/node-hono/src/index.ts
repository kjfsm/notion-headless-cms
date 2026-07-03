import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { syncAll } from "./lib/cms.js";

await syncAll();

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`Server running at http://localhost:${port}`);
