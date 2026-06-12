import { describe, expect, it } from "vitest";
import { resolvePoll } from "../internal/revalidate.js";

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

  it("basePath を指定すると導出 URL に反映される", () => {
    const r = resolvePoll({
      collection: "posts",
      slug: "hello",
      version: "v1",
      basePath: "/api/notion",
    });
    expect(r?.url).toBe("/api/notion/versions/posts/hello");
  });

  it("intervalMs / timeoutMs を引き継ぐ", () => {
    const r = resolvePoll({
      collection: "posts",
      item: { slug: "a", lastEditedTime: "v1" },
      intervalMs: 1000,
      timeoutMs: 5000,
    });
    expect(r?.intervalMs).toBe(1000);
    expect(r?.timeoutMs).toBe(5000);
  });

  it("poll 未指定は null", () => {
    expect(resolvePoll(undefined)).toBeNull();
  });

  it("collection も url も無ければ null", () => {
    expect(resolvePoll({ version: "v1" })).toBeNull();
  });

  it("collection はあるが slug / item が無ければ null", () => {
    expect(resolvePoll({ collection: "posts", version: "v1" })).toBeNull();
  });

  it("URL は解決できても version が無ければ null", () => {
    expect(resolvePoll({ collection: "posts", slug: "hello" })).toBeNull();
  });
});
