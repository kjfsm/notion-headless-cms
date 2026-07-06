import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolvePoll,
  resolveRealtime,
  useRevalidateEffect,
  wsUrlFromResolved,
} from "../internal/revalidate.js";

describe("resolvePoll", () => {
  it("url / version を明示した場合はそのまま返す", () => {
    expect(resolvePoll({ url: "/custom/check/posts/a", version: "v1" })).toEqual({
      url: "/custom/check/posts/a",
      version: "v1",
      intervalMs: undefined,
    });
  });

  it("collection + slug + version から既定 basePath で check URL を導出する", () => {
    const r = resolvePoll({
      collection: "posts",
      slug: "hello",
      version: "v1",
    });
    expect(r?.url).toBe("/api/cms/check/posts/hello");
    expect(r?.version).toBe("v1");
  });

  it("collection + item から slug と version をまとめて導出する", () => {
    const r = resolvePoll({
      collection: "posts",
      item: { slug: "hello", lastEditedTime: "2024-01-01T00:00:00.000Z" },
    });
    expect(r?.url).toBe("/api/cms/check/posts/hello");
    expect(r?.version).toBe("2024-01-01T00:00:00.000Z");
  });

  it("intervalMs を明示すればそのまま返す", () => {
    const r = resolvePoll({
      collection: "posts",
      slug: "hello",
      version: "v1",
      intervalMs: 5000,
    });
    expect(r?.intervalMs).toBe(5000);
  });

  it("poll 未指定は null", () => {
    expect(resolvePoll(undefined)).toBeNull();
  });

  it("URL は解決できても version が無ければ null", () => {
    expect(resolvePoll({ collection: "posts", slug: "hello" })).toBeNull();
  });
});

describe("resolveRealtime", () => {
  it("url を明示した場合はそのまま返す", () => {
    expect(resolveRealtime({ url: "wss://x/realtime" })).toEqual({
      url: "wss://x/realtime",
    });
  });

  it("collection + slug から相対 path を導出する", () => {
    expect(resolveRealtime({ collection: "posts", slug: "hello" })).toEqual({
      path: "/api/cms/realtime?collection=posts&slug=hello",
    });
  });

  it("collection + item から slug を導出する", () => {
    expect(resolveRealtime({ collection: "posts", item: { slug: "hello" } })).toEqual({
      path: "/api/cms/realtime?collection=posts&slug=hello",
    });
  });

  it("slug 無しは collection のみで購読する", () => {
    expect(resolveRealtime({ collection: "posts" })).toEqual({
      path: "/api/cms/realtime?collection=posts",
    });
  });

  it("basePath / path を反映する", () => {
    expect(
      resolveRealtime({
        collection: "posts",
        slug: "a",
        basePath: "/api/notion",
        path: "/ws",
      }),
    ).toEqual({ path: "/api/notion/ws?collection=posts&slug=a" });
  });

  it("realtime 未指定 / collection も url も無ければ null", () => {
    expect(resolveRealtime(undefined)).toBeNull();
    expect(resolveRealtime({})).toBeNull();
  });
});

describe("wsUrlFromResolved", () => {
  it("url 明示はそのまま返す", () => {
    expect(wsUrlFromResolved({ url: "wss://x/ws" }, "https://site/a")).toBe("wss://x/ws");
  });

  it("https の相対 path は wss:// へ", () => {
    expect(
      wsUrlFromResolved({ path: "/api/cms/realtime?collection=posts" }, "https://site/blog/a"),
    ).toBe("wss://site/api/cms/realtime?collection=posts");
  });

  it("http の相対 path は ws:// へ", () => {
    expect(
      wsUrlFromResolved({ path: "/api/cms/realtime?collection=posts" }, "http://localhost:3000/a"),
    ).toBe("ws://localhost:3000/api/cms/realtime?collection=posts");
  });
});

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  private listeners: Record<string, ((e: unknown) => void)[]> = {};
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  addEventListener(type: string, cb: (e: unknown) => void): void {
    const list = this.listeners[type] ?? [];
    list.push(cb);
    this.listeners[type] = list;
  }
  removeEventListener(): void {}
  close(): void {
    this.closed = true;
  }
  emit(type: string, e?: unknown): void {
    for (const cb of this.listeners[type] ?? []) cb(e);
  }
}

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map() } }, children);

describe("useRevalidateEffect", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    FakeWebSocket.instances = [];
  });

  /**
   * `{ stale, version }` を返す fetch モックを差し込み、spy を返す。
   * Response の body は一度しか読めないため、呼び出しごとに新しい Response を返す。
   */
  const stubCheckFetch = (stale: boolean, version = "v2") => {
    const fetchSpy = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ stale, version }), {
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    return fetchSpy;
  };

  it("realtime: WebSocket message で revalidate する", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const revalidate = vi.fn();

    renderHook(
      () =>
        useRevalidateEffect(revalidate, {
          // mount 契機の直接 revalidate を抑止し、WS push のみを検証する。
          on: [],
          realtime: {
            url: "wss://site/api/cms/realtime?collection=posts&slug=a",
          },
        }),
      { wrapper },
    );

    await waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
    expect(revalidate).not.toHaveBeenCalled();

    act(() => {
      FakeWebSocket.instances[0]?.emit("message", { data: "{}" });
    });
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("realtime 設定時は check（fetch）を行わず WebSocket 購読のみ", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const fetchSpy = stubCheckFetch(true);
    const revalidate = vi.fn();

    renderHook(
      () =>
        useRevalidateEffect(revalidate, {
          realtime: {
            url: "wss://site/api/cms/realtime?collection=posts&slug=a",
          },
          // realtime 優先のため poll は無視されるはず。
          poll: {
            collection: "posts",
            item: { slug: "a", lastEditedTime: "v1" },
          },
        }),
      { wrapper },
    );

    await waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("poll: POST /check の戻りが stale なら revalidate する", async () => {
    const fetchSpy = stubCheckFetch(true);
    const revalidate = vi.fn();

    renderHook(
      () =>
        useRevalidateEffect(revalidate, {
          poll: {
            collection: "posts",
            item: { slug: "a", lastEditedTime: "v1" },
          },
        }),
      { wrapper },
    );

    await waitFor(() => expect(revalidate).toHaveBeenCalled());

    // POST で `?v=<version>` 付きの check URL を叩く。
    const [calledUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("/api/cms/check/posts/a?v=v1");
    expect(init.method).toBe("POST");
  });

  it("poll: 戻りが stale:false なら revalidate しない", async () => {
    const fetchSpy = stubCheckFetch(false);
    const revalidate = vi.fn();

    renderHook(
      () =>
        useRevalidateEffect(revalidate, {
          poll: {
            collection: "posts",
            item: { slug: "a", lastEditedTime: "v1" },
          },
        }),
      { wrapper },
    );

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("poll: 既定トリガーは mount + visibility、可視化（hidden→visible）で再 check する", async () => {
    const fetchSpy = stubCheckFetch(false);
    const revalidate = vi.fn();
    // happy-dom の visibilityState 既定は "visible"。可視化イベントで再 check されることを確認する。

    renderHook(
      () =>
        useRevalidateEffect(revalidate, {
          // on 未指定なら既定で mount + visibility。
          poll: {
            collection: "posts",
            item: { slug: "a", lastEditedTime: "v1" },
          },
        }),
      { wrapper },
    );

    // mount で check が走る。
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const afterMount = fetchSpy.mock.calls.length;

    // visible なまま visibilitychange を発火すると追加で check。
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(afterMount));
  });

  it("poll: intervalMs 明示時のみ定期 check が走る", async () => {
    vi.useFakeTimers();
    try {
      const fetchSpy = stubCheckFetch(false);
      const revalidate = vi.fn();

      renderHook(
        () =>
          useRevalidateEffect(revalidate, {
            on: "mount",
            poll: {
              collection: "posts",
              item: { slug: "a", lastEditedTime: "v1" },
              intervalMs: 1000,
            },
          }),
        { wrapper },
      );

      // mount で 1 回。
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // interval 経過ごとに追加で check。
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("poll: intervalMs 未指定なら定期 check は走らない", async () => {
    vi.useFakeTimers();
    try {
      const fetchSpy = stubCheckFetch(false);
      const revalidate = vi.fn();

      renderHook(
        () =>
          useRevalidateEffect(revalidate, {
            on: "mount",
            poll: {
              collection: "posts",
              item: { slug: "a", lastEditedTime: "v1" },
            },
          }),
        { wrapper },
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
      // 定期 check は無いので mount の 1 回のみ。
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
