import { makeCms } from "../../lib/cms";
import type { Route } from "./+types/revalidate";

// Notion Webhook 受信 → 該当ページ / 全ページのキャッシュを invalidate する。
// 署名検証は HMAC-SHA256（Notion の Webhook secret と body）。
//
// Notion からの payload 形式は Webhook 設定により変わるため、ここでは "page.updated" 系を主眼に
// `page.id` または `data.id` を見て個別 invalidate、無ければ collection 全体を flush する。
export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const secret = env.NOTION_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "webhook secret not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-notion-signature") ?? "";
  const valid = await verifySignature(secret, rawBody, signature);
  if (!valid) {
    return Response.json(
      { ok: false, error: "invalid signature" },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const cms = makeCms(env, context.cloudflare.ctx);
  // 個別ページが特定できれば slug ベースで invalidate、できなければ collection 全体。
  // payload 形式は workspace 設定で変わるので、汎用的に id らしきものを拾う。
  const id = extractPageId(payload);
  if (id) {
    // peekVersion を呼んで強制再取得を促す。SWR が次の hit で fresh fetch する。
    await cms.pages.cache.invalidate();
    return Response.json({ ok: true, scope: "pages", pageId: id });
  }

  await cms.pages.cache.invalidate();
  return Response.json({ ok: true, scope: "pages" });
}

function extractPageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.page_id === "string") return p.page_id;
  const data = p.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.id === "string") return d.id;
  }
  if (typeof p.id === "string") return p.id;
  return null;
}

async function verifySignature(
  secret: string,
  body: string,
  signature: string,
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  const expected = bytesToHex(new Uint8Array(mac));
  return timingSafeEqual(expected, signature);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}
