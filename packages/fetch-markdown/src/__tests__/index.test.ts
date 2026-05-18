import type { Client } from "@notionhq/client";
import { describe, expect, it, vi } from "vitest";
import { markdownFetcher } from "../index";

function makeFakeClient(
  retrieveMarkdown: (args: { page_id: string }) => Promise<unknown>,
): Client {
  return {
    pages: { retrieveMarkdown },
  } as unknown as Client;
}

describe("markdownFetcher", () => {
  it("kind は 'markdown' で loadNotionBlocks は未実装", () => {
    const f = markdownFetcher();
    expect(f.kind).toBe("markdown");
    expect(f.loadNotionBlocks).toBeUndefined();
  });

  it("loadMarkdown は SDK の pages.retrieveMarkdown を呼び .markdown を返す", async () => {
    const retrieve = vi.fn(async () => ({
      object: "page_markdown",
      id: "abc-page-id",
      markdown: "# title\n\nbody",
      truncated: false,
    }));
    const client = makeFakeClient(retrieve);

    const f = markdownFetcher();
    const md = await f.loadMarkdown(client, "abc-page-id", {
      token: "test-token",
    });

    expect(md).toBe("# title\n\nbody");
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledWith({ page_id: "abc-page-id" });
  });

  it("SDK が throw した場合は source/load_markdown_failed でラップする", async () => {
    const client = makeFakeClient(async () => {
      throw new Error("network down");
    });
    const f = markdownFetcher();
    await expect(
      f.loadMarkdown(client, "missing", { token: "t" }),
    ).rejects.toMatchObject({ code: "source/load_markdown_failed" });
  });

  it("`markdown` フィールドが無いレスポンスは source/load_markdown_failed", async () => {
    const client = makeFakeClient(async () => ({
      object: "page_markdown",
      id: "x",
    }));
    const f = markdownFetcher();
    await expect(
      f.loadMarkdown(client, "x", { token: "t" }),
    ).rejects.toMatchObject({ code: "source/load_markdown_failed" });
  });
});
