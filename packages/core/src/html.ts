export interface NotionRevalidatorScriptOptions {
  /**
   * 再検証のトリガー。既定値: "visibility"
   * - "visibility": `visibilitychange` で hidden→visible の度に reload
   * - "focus": ウィンドウ focus の度に reload (visibility より発火が頻繁)
   */
  on?: "visibility" | "focus";
  /** CSP 対応の `nonce` 値。base64 / base64url 由来の文字のみ許可、不正値は throw する。 */
  nonce?: string;
}

// 属性値ブレイクアウトを防ぐため、CSP nonce は base64 / base64url 範囲に限定して検証する
const NONCE_PATTERN = /^[A-Za-z0-9+/=_-]+$/;

/**
 * React を使わないテンプレート (Astro / Hono / Express など) 向けに、
 * SWR 再検証用の `<script>...</script>` 文字列を返す。
 *
 * タブ可視化や focus を検知して `location.reload()` を呼び、サーバ側で
 * `waitUntil` 配線済みの SWR bg が更新したキャッシュを次回訪問時に取得する。
 * クエリ無し・別 API fetch 無し。
 *
 * @example
 * // Astro
 * <Fragment set:html={notionRevalidatorScript()} />
 * // Hono
 * c.html(h`...${raw(notionRevalidatorScript())}`);
 */
export function notionRevalidatorScript(
  opts: NotionRevalidatorScriptOptions = {},
): string {
  const trigger = opts.on ?? "visibility";
  const body =
    trigger === "focus"
      ? // 初回ロード直後の focus は無視するため、loaded フラグで初回をスキップ
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
