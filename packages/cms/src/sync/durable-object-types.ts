/**
 * Durable Object 関連の最小構造型（`@cloudflare/workers-types` に実依存しない）。
 * `RealtimeHubDO`/`SyncCoordinatorDO` とそのクライアント側ヘルパーが共有する。
 */

/** `namespace.get(id)` の戻り値（DO stub）の最小インターフェース。 */
export interface DurableObjectStubLike {
  fetch(input: string | Request, init?: RequestInit): Promise<Response>;
}

/** DurableObjectNamespace binding の最小インターフェース。 */
export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

/**
 * Hibernation 対応 WebSocket の最小インターフェース。
 * Cloudflare ランタイムの `WebSocket`（lib.dom の同名型）と構造的に互換。
 */
export interface HibernatableWebSocketLike {
  send(message: string): void;
  close(code?: number, reason?: string): void;
}

/**
 * DurableObjectState の WebSocket Hibernation 部分のみを表す最小インターフェース。
 * `acceptWebSocket` で接続を受理し tag を付与、`getWebSockets(tag)` で tag 別に取り出す。
 */
export interface RealtimeDurableObjectStateLike {
  acceptWebSocket(ws: HibernatableWebSocketLike, tags?: string[]): void;
  getWebSockets(tag?: string): HibernatableWebSocketLike[];
}
