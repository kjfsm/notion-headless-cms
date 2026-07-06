import type { EntrySnapshot } from "../types/entry-snapshot.js";
import { verifyPreviewSignature } from "./signature.js";

export type ReadThrough = (collection: string, slug: string) => Promise<EntrySnapshot | null>;

export interface PreviewHandlerDeps {
  readonly secret: string;
  /**
   * SyncCoordinator DO 経由で Notion を直読みする(マテリアライズしない・キャッシュに書かない)。
   * 下書き(accessible 外のステータス)も対象になる。編集者の read-after-write にも
   * 同じ経路を使う(KV 伝播遅延に関係なく最新を確認できる — #437 ADR-5)。
   */
  readThrough: ReadThrough;
  now?: () => number;
}

/**
 * `{routes}/preview/:collection/:slug?sig=&exp=` ハンドラ。
 * `HttpHandlerAdapter.onPreview` にそのまま渡せる形。
 * 署名が無効・期限切れ・対象が存在しない場合はすべて 404(存在を漏らさない)。
 */
export function createPreviewHandler(
  deps: PreviewHandlerDeps,
): (request: Request, rel: string) => Promise<Response> {
  return async (request, rel) => {
    const slashIndex = rel.indexOf("/");
    if (slashIndex <= 0 || slashIndex === rel.length - 1) {
      return new Response("Not Found", { status: 404 });
    }
    const collection = rel.slice(0, slashIndex);
    const slug = rel.slice(slashIndex + 1);

    const url = new URL(request.url);
    const signature = url.searchParams.get("sig");
    const expParam = url.searchParams.get("exp");
    if (!signature || !expParam) return new Response("Not Found", { status: 404 });

    const expiresAt = Number.parseInt(expParam, 10);
    if (Number.isNaN(expiresAt)) return new Response("Not Found", { status: 404 });

    const valid = await verifyPreviewSignature({
      secret: deps.secret,
      collection,
      slug,
      expiresAt,
      signature,
      now: deps.now?.(),
    });
    if (!valid) return new Response("Not Found", { status: 404 });

    const snapshot = await deps.readThrough(collection, slug);
    if (!snapshot) return new Response("Not Found", { status: 404 });

    return new Response(JSON.stringify(snapshot), {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  };
}
