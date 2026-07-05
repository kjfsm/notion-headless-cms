/// <reference types="vite/client" />
import { createRequestHandler } from "react-router";

// Durable Object 本体は wrangler.toml の binding 用に worker から re-export する必要がある。
export { SyncCoordinatorDO } from "./sync-coordinator-do";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
