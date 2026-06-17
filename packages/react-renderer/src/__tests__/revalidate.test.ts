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
    expect(
      resolvePoll({ url: "/custom/versions/posts/a", version: "v1" }),
    ).toEqual({
      url: "/custom/versions/posts/a",
      version: "v1",
      intervalMs: undefined,
      timeoutMs: undefined,
    });
  });

  it("collection + slug + version から既定 basePath で URL を導出する", () => {
    const r = resolvePoll({
      collection: "posts",
      slug: "hello",
      version: "v1",
    });
    expect(r?.url).toBe("/api/cms/versions/posts/hello");
    expect(r?.version).toBe("v1");
  });

  it("collection + item から slug と version をまとめて導出する", () => {
    const r = resolvePoll({
      collection: "posts",
      item: { slug: "hello", lastEditedTime: "2024-01-01T00:00:00.000Z" },
    });
    expect(r?.url).toBe("/api/cms/versions/posts/hello");
    expect(r?.version).toBe("2024-01-01T00:00:00.000Z");
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
    expect(
      resolveRealtime({ collection: "posts", item: { slug: "hello" } }),
    ).toEqual({ path: "/api/cms/realtime?collection=posts&slug=hello" });
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
    expect(wsUrlFromResolved({ url: "wss://x/ws" }, "https://site/a")).toBe(
      "wss://x/ws",
    );
  });

  it("https の相対 path は wss:// へ", () => {
    expect(
      wsUrlFromResolved(
        { path: "/api/cms/realtime?collection=posts" },
        "https://site/blog/a",
      ),
    ).toBe("wss://site/api/cms/realtime?collection=posts");
  });

  it("http の相対 path は ws:// へ", () => {
    expect(
      wsUrlFromResolved(
        { path: "/api/cms/realtime?collection=posts" },
        "http://localhost:3000/a",
      ),
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
    (this.listeners[type] ??= []).push(cb);
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

  it("realtime: WebSocket message で revalidate する", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const revalidate = vi.fn();

    renderHook(
      () =>
        useRevalidateEffect(revalidate, {
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

  it("poll: notionUpdatedAt がローダ既知 version と変われば revalidate する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ notionUpdatedAt: "v2", cachedAt: 1 }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
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
  });

  it("poll: version が同じなら revalidate しない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ notionUpdatedAt: "v1", cachedAt: 1 }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
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

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(revalidate).not.toHaveBeenCalled();
  });
});
