import { createContext } from "react-router";

import type { Env } from "./cms.js";

/**
 * v8_middleware 有効時、loader/action の `context` は `RouterContextProvider`
 * になり `AppLoadContext` のプロパティ拡張では受け取れない
 * （`context.get(cloudflareContext)` で読む）。
 */
export const cloudflareContext = createContext<{
  env: Env;
  ctx: ExecutionContext;
}>();
