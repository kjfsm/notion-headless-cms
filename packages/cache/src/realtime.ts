import type { RealtimeAdapter, RealtimeEvent } from "@notion-headless-cms/core";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStateLike,
  HibernatableWebSocketLike,
} from "./types";

export type {
  DurableObjectNamespaceLike,
  DurableObjectStateLike,
  HibernatableWebSocketLike,
} from "./types";

/** DO 内部 broadcast 用のパス（publish → hub の通知経路）。 */
const BROADCAST_PATH = "/__broadcast";

/**
 * 購読チャンネルの tag を生成する。
 * - item（slug あり）: `c:{collection}:{slug}`
 * - list（slug なし）: `c:{collection}`
 *
 * publish 側と subscribe 側で同じ規則を使うことで、getWebSockets(tag) が一致する。
 */
export function channelTag(collection: string, slug?: string): string {
  return slug ? `c:${collection}:${slug}` : `c:${collection}`;
}

/**
 * 購読リクエストの URL から `{ collection, slug? }` を取り出す。
 * `?collection=posts&slug=my-post`。collection が無ければ null（購読不可）。
 */
export function parseSubscribeChannel(
  url: URL,
): { collection: string; slug?: string } | null {
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

export interface DurableObjectRealtimeOptions {
  /** WebSocket ハブとなる Durable Object の namespace binding。 */
  namespace: DurableObjectNamespaceLike;
  /**
   * ハブのインスタンス名（`idFromName`）。既定 `"global"`。
   * 全クライアントを 1 インスタンスに集約し、tag で channel を振り分ける。
   */
  name?: string;
}

/**
 * Durable Object（WebSocket Hibernation）を使う更新通知トランスポート。
 * `publish` はハブ DO へ内部 fetch し、該当 channel の接続中クライアントへ broadcast させる。
 *
 * 利用側は {@link RealtimeHubDO} を Worker から re-export し、`wrangler.toml` で
 * binding する。クライアントは `?collection=&slug=` 付きで WS 接続して購読する。
 *
 * @example
 * createCMS({
 *   ...cloudflarePreset({ env, ctx }),
 *   realtime: durableObjectRealtime({ namespace: env.REALTIME_HUB }),
 * });
 */
export function durableObjectRealtime(
  opts: DurableObjectRealtimeOptions,
): RealtimeAdapter {
  const name = opts.name ?? "global";
  return {
    name: "durable-object",
    async publish(event: RealtimeEvent): Promise<void> {
      const id = opts.namespace.idFromName(name);
      const stub = opts.namespace.get(id);
      await stub.fetch(`https://realtime-hub${BROADCAST_PATH}`, {
        method: "POST",
        body: JSON.stringify(event),
      });
    },
  };
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
 * export { RealtimeHubDO } from "@notion-headless-cms/cache/realtime";
 */
export class RealtimeHubDO {
  constructor(
    private readonly state: DurableObjectStateLike,
    _env?: unknown,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname.endsWith(BROADCAST_PATH)) {
      const event = (await request.json()) as RealtimeEvent;
      const tag = channelTag(event.collection, event.slug);
      const delivered = broadcastToSockets(
        this.state.getWebSockets(tag),
        JSON.stringify(event),
      );
      return new Response(JSON.stringify({ ok: true, delivered }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (request.headers.get("Upgrade") === "websocket") {
      const channel = parseSubscribeChannel(url);
      if (!channel) {
        return new Response("collection query param required", { status: 400 });
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.state.acceptWebSocket(server, [
        channelTag(channel.collection, channel.slug),
      ]);
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
    ws.close(code);
  }
}
