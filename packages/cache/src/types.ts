/** R2 オブジェクトの最小インターフェース。 */
export interface R2ObjectLike {
  json<T>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
}

/** R2 list() の戻り値の最小インターフェース。 */
export interface R2ListResult {
  objects: { key: string }[];
  truncated: boolean;
  cursor?: string;
}

/** R2Bucket の最小インターフェース。 */
export interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
  put(
    key: string,
    value: ArrayBuffer | string,
    opts?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  list(opts?: { prefix?: string; cursor?: string }): Promise<R2ListResult>;
}

/** KVNamespace の最小インターフェース。 */
export interface KVNamespaceLike {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

/** Durable Object stub の最小インターフェース（`namespace.get(id)` の戻り値）。 */
export interface DurableObjectStubLike {
  fetch(input: string | Request, init?: RequestInit): Promise<Response>;
}

/** DurableObjectNamespace の最小インターフェース。 */
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
 * DurableObjectState の最小インターフェース（WebSocket Hibernation 部分のみ）。
 * `acceptWebSocket` で接続を受理し tag を付与、`getWebSockets(tag)` で tag 別に取り出す。
 */
export interface DurableObjectStateLike {
  acceptWebSocket(ws: HibernatableWebSocketLike, tags?: string[]): void;
  getWebSockets(tag?: string): HibernatableWebSocketLike[];
}
