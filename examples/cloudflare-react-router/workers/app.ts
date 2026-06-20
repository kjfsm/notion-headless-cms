/// <reference types="vite/client" />
import { createRequestHandler } from "react-router";

// 更新通知 push 用の Durable Object。wrangler.toml の durable_objects.bindings で
// REALTIME_HUB として binding する（class を Worker から re-export するのが Cloudflare の作法）。
export { RealtimeHubDO } from "@notion-headless-cms/client/cloudflare";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const REALTIME_PATH = "/api/cms/realtime";

export default {
  async fetch(request, env, ctx) {
    // クライアントの WebSocket 購読（NotionRevalidator の realtime）を Durable Object へ橋渡しする。
    // `durableObjectRealtime` の既定インスタンス名 "global" と一致させる。
    const url = new URL(request.url);
    if (url.pathname === REALTIME_PATH && env.REALTIME_HUB) {
      const id = env.REALTIME_HUB.idFromName("global");
      return env.REALTIME_HUB.get(id).fetch(request);
    }
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
