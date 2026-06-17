/**
 * 更新通知イベント。サーバ側でキャッシュが最新化された直後に発行され、
 * 接続中クライアントへ「該当コレクション / slug が version へ更新された」ことだけを伝える。
 * 本文は載せない（クライアントは loader 再実行で取得する）。
 *
 * - `slug` 無し: リスト（一覧）の更新。
 * - `version`: Notion の `last_edited_time` 相当（item）または `getListVersion`（list）。
 */
export interface RealtimeEvent {
  collection: string;
  slug?: string;
  version: string;
}

/**
 * 更新通知のトランスポート抽象。`CacheAdapter` と同じく「name + 構造型」で注入し、
 * core は WebSocket / Durable Object / 外部 pub-sub などの実体を知らない。
 *
 * `publish` はキャッシュ書き込み完了後に core から呼ばれる。fail-soft であること
 * （通知の失敗が配信やキャッシュ更新を壊してはならない）。実装側で投げても core 側で握り潰す。
 *
 * @example
 * const adapter: RealtimeAdapter = {
 *   name: "durable-object",
 *   async publish(event) {
 *     await stub.fetch("https://do/broadcast", {
 *       method: "POST",
 *       body: JSON.stringify(event),
 *     });
 *   },
 * };
 */
export interface RealtimeAdapter {
  readonly name: string;
  publish(event: RealtimeEvent): Promise<void>;
}
