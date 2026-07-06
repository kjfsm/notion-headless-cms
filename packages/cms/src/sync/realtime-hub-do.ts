import type { RealtimeAdapter, RealtimePayload } from "../realtime.js";
import { channelTag } from "../realtime.js";
import type {
  DurableObjectNamespaceLike,
  HibernatableWebSocketLike,
  RealtimeDurableObjectStateLike,
} from "./durable-object-types.js";

export type {
  DurableObjectNamespaceLike,
  DurableObjectStubLike,
  HibernatableWebSocketLike,
  RealtimeDurableObjectStateLike,
} from "./durable-object-types.js";

/** DO 内部 broadcast 用のパス（publish → hub の通知経路）。 */
const BROADCAST_PATH = "/__broadcast";

/**
 * 購読リクエストの URL から `{ collection, slug? }` を取り出す。
 * `?collection=posts&slug=my-post`。collection が無ければ null（購読不可）。
 */
export function parseSubscribeChannel(url: URL): { collection: string; slug?: string } | null {
  const collection = url.searchParams.get("collection");
  if (!collection) return null;
  const slug = url.searchParams.get("slug") ?? undefined;
  return { collection, slug };
}

/**
 * 接続中ソケットへメッセージを送る。1 ソケットの送信失敗で全体を止めないよう個別に握り潰す。
 * @returns 送信に成功したソケット数。
 */
export function broadcastToSockets(
  sockets: readonly HibernatableWebSocketLike[],
  message: string,
): number {
  let delivered = 0;
  for (const ws of sockets) {
    try {
      ws.send(message);
      delivered++;
    } catch {
      // クローズ済みソケット等は無視して継続
    }
  }
  return delivered;
}

/** WebSocket close に渡して安全なコードか判定する（1000–4999、予約コードを除く）。 */
function isValidCloseCode(code: number): boolean {
  if (code < 1000 || code > 4999) return false;
  return code !== 1005 && code !== 1006 && code !== 1015;
}

export interface DurableObjectRealtimeOptions {
  /** WebSocket ハブとなる Durable Object の namespace binding。 */
  readonly namespace: DurableObjectNamespaceLike;
  /**
   * ハブのインスタンス名（`idFromName`）。既定 `"global"`。
   * 全クライアントを 1 インスタンスに集約し、tag で channel を振り分ける。
   */
  readonly name?: string;
}

/**
 * Durable Object（WebSocket Hibernation）を使う更新通知トランスポート（v2 の
 * `durableObjectRealtime` を v3 の `RealtimeAdapter`（`publish(tag, payload)`）に合わせて移植）。
 *
 * 利用側は {@link RealtimeHubDO} を Worker から re-export し、`wrangler.toml` で binding する。
 * クライアントは `?collection=&slug=` 付きで WS 接続して購読する。
 *
 * @example
 * createCMS({
 *   ...,
 *   realtime: durableObjectRealtime({ namespace: env.REALTIME_HUB }),
 * });
 */
export function durableObjectRealtime(opts: DurableObjectRealtimeOptions): RealtimeAdapter {
  const name = opts.name ?? "global";
  return {
    async publish(tag: string, payload: RealtimePayload): Promise<void> {
      const id = opts.namespace.idFromName(name);
      const stub = opts.namespace.get(id);
      await stub.fetch(`https://realtime-hub${BROADCAST_PATH}`, {
        method: "POST",
        body: JSON.stringify({ tag, payload }),
      });
    },
  };
}

export interface ForwardRealtimeUpgradeOptions {
  /** WebSocket ハブ Durable Object の namespace binding（`env.REALTIME_HUB` 等）。 */
  readonly namespace: DurableObjectNamespaceLike;
  /** 転送する購読リクエスト（`Upgrade: websocket`, `?collection=&slug=` を含む）。 */
  readonly request: Request;
  /**
   * ハブのインスタンス名（`idFromName`）。既定 `"global"`。
   * publish 側（{@link durableObjectRealtime} の `name`）と揃えないと通知が届かないため、
   * 通常は両方とも既定のままにする。
   */
  readonly name?: string;
}

/**
 * WebSocket 購読リクエスト（例: `GET /api/cms/realtime`）を {@link RealtimeHubDO} へ転送する。
 * `cms.fetch()` は Upgrade を処理しないため、consumer は catch-all より前でこれを呼ぶ。
 *
 * @example
 * app.all("/api/cms/realtime", (c) =>
 *   forwardRealtimeUpgrade({ namespace: c.env.REALTIME_HUB, request: c.req.raw }));
 */
export function forwardRealtimeUpgrade(opts: ForwardRealtimeUpgradeOptions): Promise<Response> {
  const { namespace, request } = opts;
  const stub = namespace.get(namespace.idFromName(opts.name ?? "global"));
  return stub.fetch(request);
}

interface WebSocketPairLike {
  0: HibernatableWebSocketLike;
  1: HibernatableWebSocketLike;
}
declare const WebSocketPair: { new (): WebSocketPairLike };

/**
 * 更新通知の WebSocket ハブとなる Durable Object。
 *
 * - `GET`（Upgrade: websocket, `?collection=&slug=`）: 購読接続を受理し channel tag を付与。
 * - `POST {BROADCAST_PATH}`: `durableObjectRealtime` から呼ばれ、該当 channel へ broadcast。
 *
 * WebSocket Hibernation API（`acceptWebSocket` / `getWebSockets`）を使い、アイドル接続で
 * 課金されないようにする。利用側は Worker から re-export して binding するだけでよい。
 *
 * @example
 * export { RealtimeHubDO } from "@notion-headless-cms/cms/cloudflare";
 */
export class RealtimeHubDO {
  constructor(
    private readonly state: RealtimeDurableObjectStateLike,
    _env?: unknown,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname.endsWith(BROADCAST_PATH)) {
      const { tag, payload } = (await request.json()) as {
        tag: string;
        payload: RealtimePayload;
      };
      const delivered = broadcastToSockets(this.state.getWebSockets(tag), JSON.stringify(payload));
      return new Response(JSON.stringify({ ok: true, delivered }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (request.headers.get("Upgrade") === "websocket") {
      const channel = parseSubscribeChannel(url);
      if (!channel) {
        return new Response("collection query param required", {
          status: 400,
        });
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.state.acceptWebSocket(server, [channelTag(channel.collection, channel.slug)]);
      // Response.webSocket は Workers ランタイム拡張（lib.dom の ResponseInit には無い）。
      return new Response(null, {
        status: 101,
        webSocket: client,
      } as ResponseInit & { webSocket: unknown });
    }

    return new Response("Not Found", { status: 404 });
  }

  /** Hibernation: メッセージは現状購読のみで未使用（将来の ping/pong 用フック）。 */
  webSocketMessage(): void {}

  /** Hibernation: クローズ時はサーバ側もクローズして接続を解放する。 */
  webSocketClose(
    ws: HibernatableWebSocketLike,
    code: number,
    _reason: string,
    _wasClean: boolean,
  ): void {
    // 予約コード（1005/1006/1015）や範囲外を close() に渡すと RangeError になるため、
    // 正常域のときだけコードを引き継ぎ、それ以外は引数なしで閉じる。
    if (isValidCloseCode(code)) ws.close(code);
    else ws.close();
  }
}
