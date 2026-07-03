/// <reference types="vite/client" />
import { RealtimeHubDO } from "@notion-headless-cms/cms/cloudflare";
import { createRequestHandler } from "react-router";
import { SyncCoordinatorDO } from "../app/lib/do.js";

export { RealtimeHubDO, SyncCoordinatorDO };

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
