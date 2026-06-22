import type { RealtimeEvent } from "@notion-headless-cms/core";
import { describe, expect, it, vi } from "vitest";
import {
  broadcastToSockets,
  channelTag,
  durableObjectRealtime,
  parseSubscribeChannel,
  RealtimeHubDO,
} from "../realtime";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStateLike,
  HibernatableWebSocketLike,
} from "../types";

describe("channelTag", () => {
  it("slug ありは c:{collection}:{slug}", () => {
    expect(channelTag("posts", "my-post")).toBe("c:posts:my-post");
  });
  it("slug なしは c:{collection}", () => {
    expect(channelTag("posts")).toBe("c:posts");
  });
});

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
  it("publish は hub DO へ event を POST する", async () => {
    const fetchMock = vi
      .fn<DurableObjectStubLike["fetch"]>()
      .mockResolvedValue(new Response(null));
    const idFromName = vi.fn().mockReturnValue("id-token");
    const get = vi.fn().mockReturnValue({ fetch: fetchMock });
    const namespace: DurableObjectNamespaceLike = { idFromName, get };

    const adapter = durableObjectRealtime({ namespace });
    const event: RealtimeEvent = {
      collection: "posts",
      slug: "my-post",
      version: "2024-01-02T00:00:00Z",
    };
    await adapter.publish(event);

    expect(idFromName).toHaveBeenCalledWith("global");
    expect(get).toHaveBeenCalledWith("id-token");
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual(event);
  });

  it("name でハブインスタンスを指定できる", async () => {
    const idFromName = vi.fn().mockReturnValue("id");
    const namespace: DurableObjectNamespaceLike = {
      idFromName,
      get: () => ({ fetch: vi.fn().mockResolvedValue(new Response(null)) }),
    };
    await durableObjectRealtime({ namespace, name: "hub-1" }).publish({
      collection: "posts",
      version: "v",
    });
    expect(idFromName).toHaveBeenCalledWith("hub-1");
  });
});

describe("RealtimeHubDO broadcast", () => {
  it("POST で該当 channel tag のソケットへ event を送る", async () => {
    const sent: string[] = [];
    const socket: HibernatableWebSocketLike = {
      send: (m) => sent.push(m),
      close: () => {},
    };
    const getWebSockets = vi.fn().mockReturnValue([socket]);
    const state: DurableObjectStateLike = {
      acceptWebSocket: vi.fn(),
      getWebSockets,
    };

    const hub = new RealtimeHubDO(state);
    const event: RealtimeEvent = {
      collection: "posts",
      slug: "my-post",
      version: "v2",
    };
    const res = await hub.fetch(
      new Request("https://hub/__broadcast", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    );

    expect(getWebSockets).toHaveBeenCalledWith("c:posts:my-post");
    expect(sent).toEqual([JSON.stringify(event)]);
    expect(await res.json()).toEqual({ ok: true, delivered: 1 });
  });

  it("不明なリクエストは 404", async () => {
    const state: DurableObjectStateLike = {
      acceptWebSocket: vi.fn(),
      getWebSockets: vi.fn().mockReturnValue([]),
    };
    const res = await new RealtimeHubDO(state).fetch(
      new Request("https://hub/other"),
    );
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

import type { DurableObjectStubLike } from "../types";
