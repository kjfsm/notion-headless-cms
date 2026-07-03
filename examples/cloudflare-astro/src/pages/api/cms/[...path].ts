import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { type Env, makeCms } from "../../../lib/cms";

// 画像プロキシ・webhook・OGP を cms.fetch() 1 つにまとめて配信する。
const handle: APIRoute = ({ request, locals }) =>
  makeCms(env as Env, locals.cfContext).fetch(request);

export const GET = handle;
export const POST = handle;
