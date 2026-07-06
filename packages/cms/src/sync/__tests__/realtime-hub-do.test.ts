import { describe, expect, it, vi } from "vitest";

import type { RealtimePayload } from "../../realtime.js";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStubLike,
  HibernatableWebSocketLike,
  RealtimeDurableObjectStateLike,
} from "../durable-object-types.js";
import {
  broadcastToSockets,
  durableObjectRealtime,
  forwardRealtimeUpgrade,
  parseSubscribeChannel,
  RealtimeHubDO,
} from "../realtime-hub-do.js";

describe("parseSubscribeChannel", () => {
  it("collection と slug を取り出す", () => {
    const url = new URL("https://x/ws?collection=posts&slug=my-post");
    expect(parseSubscribeChannel(url)).toEqual({
      collection: "posts",
      slug: "my-post",
    });
  });
  it("slug 省略は collection のみ", () => {
    const url = new URL("https://x/ws?collection=posts");
    expect(parseSubscribeChannel(url)).toEqual({
      collection: "posts",
      slug: undefined,
    });
  });
  it("collection が無ければ null", () => {
    const url = new URL("https://x/ws");
    expect(parseSubscribeChannel(url)).toBeNull();
  });
});

describe("broadcastToSockets", () => {
  it("全ソケットへ送信し件数を返す", () => {
    const sent: string[] = [];
    const make = (): HibernatableWebSocketLike => ({
      send: (m) => sent.push(m),
      close: () => {},
    });
    const delivered = broadcastToSockets([make(), make()], "hello");
    expect(delivered).toBe(2);
    expect(sent).toEqual(["hello", "hello"]);
  });

  it("1 ソケットの送信失敗で全体を止めない", () => {
    const ok: string[] = [];
    const bad: HibernatableWebSocketLike = {
      send: () => {
        throw new Error("closed");
      },
      close: () => {},
    };
    const good: HibernatableWebSocketLike = {
      send: (m) => ok.push(m),
      close: () => {},
    };
    const delivered = broadcastToSockets([bad, good], "x");
    expect(delivered).toBe(1);
    expect(ok).toEqual(["x"]);
  });
});

describe("durableObjectRealtime", () => {
  it("publish は事前計算済みの tag と payload を hub DO へ POST する", async () => {
    const fetchMock = vi.fn<DurableObjectStubLike["fetch"]>().mockResolvedValue(new Response(null));
    const idFromName = vi.fn().mockReturnValue("id-token");
    const get = vi.fn().mockReturnValue({ fetch: fetchMock });
    const namespace: DurableObjectNamespaceLike = { idFromName, get };

    const adapter = durableObjectRealtime({ namespace });
    const payload: RealtimePayload = {
      collection: "posts",
      slug: "my-post",
      version: "2024-01-02T00:00:00Z",
    };
    await adapter.publish("c:posts:my-post", payload);

    expect(idFromName).toHaveBeenCalledWith("global");
    expect(get).toHaveBeenCalledWith("id-token");
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      tag: "c:posts:my-post",
      payload,
    });
  });

  it("name でハブインスタンスを指定できる", async () => {
    const idFromName = vi.fn().mockReturnValue("id");
    const namespace: DurableObjectNamespaceLike = {
      idFromName,
      get: () => ({ fetch: vi.fn().mockResolvedValue(new Response(null)) }),
    };
    await durableObjectRealtime({ namespace, name: "hub-1" }).publish("c:posts", {
      collection: "posts",
      version: "v",
    });
    expect(idFromName).toHaveBeenCalledWith("hub-1");
  });
});

describe("forwardRealtimeUpgrade", () => {
  it("idFromName('global') から解決した stub にリクエストを転送する", async () => {
    const request = new Request("https://site/api/cms/realtime?collection=posts", {
      headers: { Upgrade: "websocket" },
    });
    const hubResponse = new Response("upgraded");
    const fetchMock = vi.fn<DurableObjectStubLike["fetch"]>().mockResolvedValue(hubResponse);
    const idFromName = vi.fn().mockReturnValue("id-token");
    const get = vi.fn().mockReturnValue({ fetch: fetchMock });
    const namespace: DurableObjectNamespaceLike = { idFromName, get };

    const res = await forwardRealtimeUpgrade({ namespace, request });

    expect(idFromName).toHaveBeenCalledWith("global");
    expect(get).toHaveBeenCalledWith("id-token");
    expect(fetchMock).toHaveBeenCalledWith(request);
    expect(res).toBe(hubResponse);
  });

  it("name で購読ハブを指定できる（publish 側と揃える）", async () => {
    const idFromName = vi.fn().mockReturnValue("id");
    const namespace: DurableObjectNamespaceLike = {
      idFromName,
      get: () => ({ fetch: vi.fn().mockResolvedValue(new Response(null)) }),
    };
    await forwardRealtimeUpgrade({
      namespace,
      request: new Request("https://site/api/cms/realtime"),
      name: "hub-1",
    });
    expect(idFromName).toHaveBeenCalledWith("hub-1");
  });
});

describe("RealtimeHubDO broadcast", () => {
  it("POST で指定 tag のソケットへ payload を送る", async () => {
    const sent: string[] = [];
    const socket: HibernatableWebSocketLike = {
      send: (m) => sent.push(m),
      close: () => {},
    };
    const getWebSockets = vi.fn().mockReturnValue([socket]);
    const state: RealtimeDurableObjectStateLike = {
      acceptWebSocket: vi.fn(),
      getWebSockets,
    };

    const hub = new RealtimeHubDO(state);
    const payload: RealtimePayload = {
      collection: "posts",
      slug: "my-post",
      version: "v2",
    };
    const res = await hub.fetch(
      new Request("https://hub/__broadcast", {
        method: "POST",
        body: JSON.stringify({ tag: "c:posts:my-post", payload }),
      }),
    );

    expect(getWebSockets).toHaveBeenCalledWith("c:posts:my-post");
    expect(sent).toEqual([JSON.stringify(payload)]);
    expect(await res.json()).toEqual({ ok: true, delivered: 1 });
  });

  it("不明なリクエストは 404", async () => {
    const state: RealtimeDurableObjectStateLike = {
      acceptWebSocket: vi.fn(),
      getWebSockets: vi.fn().mockReturnValue([]),
    };
    const res = await new RealtimeHubDO(state).fetch(new Request("https://hub/other"));
    expect(res.status).toBe(404);
  });
});

describe("RealtimeHubDO webSocketClose", () => {
  const makeHub = () =>
    new RealtimeHubDO({
      acceptWebSocket: vi.fn(),
      getWebSockets: vi.fn().mockReturnValue([]),
    });

  it("予約コード（1006）は引数なしで close し throw しない", () => {
    const closed: number[] = [];
    const ws: HibernatableWebSocketLike = {
      send: () => {},
      // 実ランタイムは予約コードを渡すと RangeError を投げる挙動を模す
      close: (code?: number) => {
        if (code === 1005 || code === 1006 || code === 1015) {
          throw new RangeError("invalid close code");
        }
        closed.push(code ?? -1);
      },
    };
    expect(() => makeHub().webSocketClose(ws, 1006, "", false)).not.toThrow();
    expect(closed).toEqual([-1]);
  });

  it("正常コード（1000）はそのまま引き継ぐ", () => {
    const closed: number[] = [];
    const ws: HibernatableWebSocketLike = {
      send: () => {},
      close: (code?: number) => closed.push(code ?? -1),
    };
    makeHub().webSocketClose(ws, 1000, "", true);
    expect(closed).toEqual([1000]);
  });
});
