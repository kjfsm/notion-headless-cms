import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { type Env, makeCms } from "../../../lib/cms";

// ライブラリ提供の HTTP ハンドラを 1 つの catch-all に mount する。
// 画像プロキシ(/api/cms/images/:hash)・更新検知(versions/check)・Webhook revalidate を処理する。
const handle: APIRoute = ({ request, locals }) =>
  makeCms(env as Env, locals.cfContext).handler()(request);

export const GET = handle;
export const POST = handle;
