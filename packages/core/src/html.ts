// React を使わないテンプレート (Astro / Hono / Express など) で SWR 体験を
// 成立させるための、ゼロ依存の小さな <script> 文字列ジェネレータ。
//
// 使い方 (Astro):
//   import { notionRevalidatorScript } from "@notion-headless-cms/core/html";
//   <Fragment set:html={notionRevalidatorScript()} />
//
// 使い方 (Hono):
//   import { raw, html as h } from "hono/html";
//   c.html(h`...${raw(notionRevalidatorScript())}`);
//
// 仕組み: タブ可視化 (visibilitychange で hidden→visible) を検知して
// `location.reload()` で同じ URL を再リクエストする。サーバ側は
// `cloudflarePreset` 等で `waitUntil` が配線されていれば、前回訪問時に
// SWR bg が KV を最新化済み → 再取得で新内容が返る。クエリ無し・別 API fetch 無し。

export interface NotionRevalidatorScriptOptions {
  /**
   * 再検証のトリガー。既定値: "visibility"
   * - "visibility": タブ可視化 (`visibilitychange` で hidden→visible) の度に reload
   * - "focus": ウィンドウ focus の度に reload (visibility より発火が頻繁)
   */
  on?: "visibility" | "focus";
  /**
   * `<script nonce="...">` を出力したい場合 (CSP 対応)。
   * 英数字・`-` / `_` / `+` / `/` / `=` のみ許可。属性値ブレイクアウトを防ぐため
   * 不正な文字が含まれていれば throw する。
   */
  nonce?: string;
}

// CSP nonce は本来 base64 / base64url 由来のランダム文字列。属性値の
// クォート・タグブレイクアウトを未然に防ぐため、最小限の許可セットで検証する。
const NONCE_PATTERN = /^[A-Za-z0-9+/=_-]+$/;

/**
 * React を使わないページに埋め込むための `<script>...</script>` 文字列を返す。
 * 返り値は外部入力を埋め込まない（nonce は厳格に検証）safe な内容。
 */
export function notionRevalidatorScript(
  opts: NotionRevalidatorScriptOptions = {},
): string {
  const trigger = opts.on ?? "visibility";
  const body =
    trigger === "focus"
      ? // 初回ロード時の focus は無視するため、loaded フラグで初回をスキップ。
        'let l=false;addEventListener("focus",()=>{if(l)location.reload();l=true});'
      : 'document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")location.reload()});';
  let nonceAttr = "";
  if (opts.nonce !== undefined) {
    if (!NONCE_PATTERN.test(opts.nonce)) {
      throw new Error(
        "notionRevalidatorScript: nonce に不正な文字が含まれています。base64 / base64url 由来の英数字のみ受け付けます。",
      );
    }
    nonceAttr = ` nonce="${opts.nonce}"`;
  }
  return `<script${nonceAttr}>(()=>{${body}})();</script>`;
}
