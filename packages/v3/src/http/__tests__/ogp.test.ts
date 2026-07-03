import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOgpHandler, isUrlAllowed, parseOgpHtml } from "../ogp.js";

function ogpRequest(url: string): Request {
  return new Request(`https://x/api/cms/ogp?url=${encodeURIComponent(url)}`);
}

describe("isUrlAllowed (SSRF ガード)", () => {
  it("http/https のみ許可する", () => {
    expect(isUrlAllowed(new URL("https://example.com"))).toBe(true);
    expect(isUrlAllowed(new URL("http://example.com"))).toBe(true);
    expect(isUrlAllowed(new URL("ftp://example.com"))).toBe(false);
    expect(isUrlAllowed(new URL("file:///etc/passwd"))).toBe(false);
  });

  it("標準ポート(80/443)以外は拒否する", () => {
    expect(isUrlAllowed(new URL("https://example.com:8443"))).toBe(false);
    expect(isUrlAllowed(new URL("https://example.com:443"))).toBe(true);
    expect(isUrlAllowed(new URL("http://example.com:80"))).toBe(true);
  });

  it("localhost・.local・.internal を拒否する", () => {
    expect(isUrlAllowed(new URL("http://localhost"))).toBe(false);
    expect(isUrlAllowed(new URL("http://foo.local"))).toBe(false);
    expect(isUrlAllowed(new URL("http://service.internal"))).toBe(false);
  });

  it.each([
    "http://127.0.0.1",
    "http://10.0.0.1",
    "http://172.16.0.1",
    "http://172.31.255.255",
    "http://192.168.1.1",
    "http://169.254.169.254",
    "http://0.0.0.0",
  ])("プライベート/リンクローカル IPv4 %s を拒否する", (url) => {
    expect(isUrlAllowed(new URL(url))).toBe(false);
  });

  it("172.32.0.1 のようなレンジ外は許可する", () => {
    expect(isUrlAllowed(new URL("http://172.32.0.1"))).toBe(true);
  });

  it("::1 (IPv6 loopback) を拒否する", () => {
    expect(isUrlAllowed(new URL("http://[::1]"))).toBe(false);
  });

  it("fc00::/7 (unique local) を拒否する", () => {
    expect(isUrlAllowed(new URL("http://[fd00::1]"))).toBe(false);
  });

  it("グローバル IP は許可する", () => {
    expect(isUrlAllowed(new URL("http://8.8.8.8"))).toBe(true);
  });
});

describe("parseOgpHtml", () => {
  it("og:title/description/image/site_name を抽出する", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="タイトル" />
        <meta property="og:description" content="説明文" />
        <meta property="og:image" content="https://example.com/a.png" />
        <meta property="og:site_name" content="サイト名" />
      </head></html>
    `;
    expect(parseOgpHtml(html)).toEqual({
      title: "タイトル",
      description: "説明文",
      image: "https://example.com/a.png",
      siteName: "サイト名",
    });
  });

  it("og:title が無ければ <title> をフォールバックにする", () => {
    const html = "<html><head><title>ページタイトル</title></head></html>";
    expect(parseOgpHtml(html)).toEqual({ title: "ページタイトル" });
  });

  it("meta タグが無ければ空オブジェクトを返す", () => {
    expect(parseOgpHtml("<html></html>")).toEqual({});
  });

  it("属性の順序が name→content でも content→property でも抽出できる", () => {
    const html = `<meta content="逆順タイトル" property="og:title">`;
    expect(parseOgpHtml(html)).toEqual({ title: "逆順タイトル" });
  });

  it("シングルクォート属性にも対応する", () => {
    const html = `<meta property='og:title' content='シングル' />`;
    expect(parseOgpHtml(html)).toEqual({ title: "シングル" });
  });
});

describe("createOgpHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("url パラメータが無ければ 400 (handler/ogp_url_forbidden)", async () => {
    const handler = createOgpHandler();
    const res = await handler(new Request("https://x/api/cms/ogp"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      ok: false,
      code: "handler/ogp_url_forbidden",
    });
  });

  it("不正な URL は 400", async () => {
    const handler = createOgpHandler();
    const res = await handler(ogpRequest("not a url"));
    expect(res.status).toBe(400);
  });

  it("SSRF ガードに引っかかる URL は fetch せず 400", async () => {
    const fetchImpl = vi.fn();
    const handler = createOgpHandler({ fetchImpl });
    const res = await handler(
      ogpRequest("http://169.254.169.254/latest/meta-data"),
    );
    expect(res.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("正常な HTML を取得し OGP を返す(cache-control ヘッダつき)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('<meta property="og:title" content="Hi" />', {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    const handler = createOgpHandler({ fetchImpl });
    const res = await handler(ogpRequest("https://example.com/article"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(await res.json()).toEqual({ ok: true, ogp: { title: "Hi" } });
  });

  it("text/html 以外は空 OGP を返す", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("binary", {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const handler = createOgpHandler({ fetchImpl });
    const res = await handler(ogpRequest("https://example.com/a.png"));
    expect(await res.json()).toEqual({ ok: true, ogp: {} });
  });

  it("fetch が失敗すれば 502 (handler/ogp_fetch_failed)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network error"));
    const handler = createOgpHandler({ fetchImpl });
    const res = await handler(ogpRequest("https://example.com"));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      ok: false,
      code: "handler/ogp_fetch_failed",
    });
  });

  it("HTTP エラーレスポンスも 502 扱いにする", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 404 }));
    const handler = createOgpHandler({ fetchImpl });
    const res = await handler(ogpRequest("https://example.com/missing"));
    expect(res.status).toBe(502);
  });

  it("redirect は各 hop で SSRF ガードを再検証しながら追跡する", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://example.com/final" },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<meta property="og:title" content="Final" />', {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
    const handler = createOgpHandler({ fetchImpl });
    const res = await handler(ogpRequest("https://example.com/start"));
    expect(await res.json()).toEqual({ ok: true, ogp: { title: "Final" } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("redirect 先がプライベート IP なら失敗として扱う(SSRF 対策)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/secret" },
      }),
    );
    const handler = createOgpHandler({ fetchImpl });
    const res = await handler(ogpRequest("https://example.com/start"));
    expect(res.status).toBe(502);
  });

  it("maxRedirects を超えるリダイレクトは失敗として扱う", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://example.com/loop" },
      }),
    );
    const handler = createOgpHandler({ fetchImpl, maxRedirects: 1 });
    const res = await handler(ogpRequest("https://example.com/start"));
    expect(res.status).toBe(502);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("maxBodyBytes を超える本文は打ち切って読む", async () => {
    const bigHtml = `<meta property="og:title" content="Head" />${"x".repeat(1000)}`;
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(bigHtml, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const handler = createOgpHandler({ fetchImpl, maxBodyBytes: 40 });
    const res = await handler(ogpRequest("https://example.com"));
    expect(await res.json()).toEqual({ ok: true, ogp: { title: "Head" } });
  });

  it("cache が指定されていればヒット時に fetch せず返す", async () => {
    const fetchImpl = vi.fn();
    const cache = {
      get: vi.fn().mockResolvedValue({ title: "Cached" }),
      put: vi.fn(),
    };
    const handler = createOgpHandler({ fetchImpl, cache });
    const res = await handler(ogpRequest("https://example.com"));
    expect(await res.json()).toEqual({ ok: true, ogp: { title: "Cached" } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("cache 未ヒット時は fetch 結果を cache.put に保存する", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('<meta property="og:title" content="Fresh" />', {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const cache = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
    const handler = createOgpHandler({ fetchImpl, cache });
    await handler(ogpRequest("https://example.com"));
    expect(cache.put).toHaveBeenCalledWith("https://example.com/", {
      title: "Fresh",
    });
  });

  it("allowUrl で追加拒否ができる", async () => {
    const fetchImpl = vi.fn();
    const handler = createOgpHandler({
      fetchImpl,
      allowUrl: (url) => url.hostname !== "blocked.example.com",
    });
    const res = await handler(ogpRequest("https://blocked.example.com"));
    expect(res.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("タイムアウトすると fetch は中断され失敗として扱う", async () => {
    const fetchImpl = vi.fn(
      (_input: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const handler = createOgpHandler({ fetchImpl, timeoutMs: 1000 });
    const resPromise = handler(ogpRequest("https://example.com"));
    await vi.advanceTimersByTimeAsync(1000);
    const res = await resPromise;
    expect(res.status).toBe(502);
  });
});
