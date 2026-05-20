// 画像プロキシ route のゴールドサンプル。
// `cms.handler()` / `createNextHandler(cms)` でも同じ機能が提供されるが、
// ・キャッシュヘッダや CDN ヒント (CDN-Cache-Control) を独自に追加したい
// ・ログや認可を挟みたい
// といったケースでは、catch-all (`[...path]/route.ts`) より具体的なこのパスが優先される。
//
// 他 example (minimal-node / node-hono / cloudflare-*) からも参照する基準実装。
import { cms } from "@/app/lib/cms";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  const image = await cms.getCachedImage(hash);
  if (!image) {
    return new Response("Not Found", { status: 404 });
  }
  const headers = new Headers({
    // immutable: hash がコンテンツ依存なので URL が変われば内容も変わる。
    "cache-control": "public, max-age=31536000, immutable",
  });
  if (image.contentType) headers.set("content-type", image.contentType);
  return new Response(image.data, { headers });
}
