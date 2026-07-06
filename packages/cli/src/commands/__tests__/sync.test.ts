import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CMSConfig } from "../../index.js";

const loadConfigMock = vi.fn<() => Promise<CMSConfig>>();
vi.mock("../../config-loader.js", () => ({ loadConfig: loadConfigMock }));

const jitiImportMock = vi.fn();
vi.mock("jiti", () => ({
  createJiti: () => ({ import: jitiImportMock }),
}));

function richText(text: string) {
  return [{ type: "text", plain_text: text, text: { content: text } }];
}

const notionPage = {
  object: "page" as const,
  id: "p1",
  url: "https://notion.so/p1",
  last_edited_time: "2026-01-01T00:00:00.000Z",
  properties: {
    title: { type: "title", title: richText("Hello") },
    slug: { type: "rich_text", rich_text: richText("hello") },
  },
};

// createCMS() は notion.token 指定時に内部で `new Client({ auth: token })` する
// (`resolveClient`)。ここでは実 Notion API を呼ばず、1 ページだけ返す fake に差し替える。
vi.mock("@notionhq/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@notionhq/client")>();
  return {
    ...actual,
    Client: vi.fn().mockImplementation(function FakeClient() {
      return {
        dataSources: {
          query: vi.fn().mockResolvedValue({
            results: [notionPage],
            next_cursor: null,
            has_more: false,
          }),
        },
        pages: { retrieve: vi.fn().mockRejectedValue(new Error("not found")) },
        blocks: {
          children: {
            list: vi.fn().mockResolvedValue({
              results: [],
              next_cursor: null,
              has_more: false,
            }),
          },
        },
      };
    }),
  };
});

const { runSync } = await import("../sync.js");
const { defineCollection, prop } = await import("@notion-headless-cms/cms");

describe("runSync", () => {
  let tmpDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhc-sync-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    loadConfigMock.mockReset();
    jitiImportMock.mockReset();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("schemaModule 未定義なら CMSError(cli/config_invalid) を投げる", async () => {
    loadConfigMock.mockResolvedValue({
      collections: {},
    } as CMSConfig);

    await expect(runSync({ token: "tok", silent: true })).rejects.toMatchObject(
      { code: "cli/config_invalid" },
    );
  });

  it("スキーマモジュールに対応する export が無ければ CMSError(cli/schema_invalid) を投げる", async () => {
    loadConfigMock.mockResolvedValue({
      schemaModule: "src/schema.ts",
      collections: { posts: { databaseId: "ds-posts" } },
    } as CMSConfig);
    jitiImportMock.mockResolvedValue({});

    await expect(runSync({ token: "tok", silent: true })).rejects.toMatchObject(
      { code: "cli/schema_invalid" },
    );
  });

  it("ローカルファイルストアへ同期し、cacheDir に entry を書き込む", async () => {
    const posts = defineCollection({
      dataSourceId: "ds-posts",
      slug: "slug",
      properties: { title: prop.title(), slug: prop.richText() },
    });
    loadConfigMock.mockResolvedValue({
      schemaModule: "src/schema.ts",
      collections: { posts: { databaseId: "ds-posts" } },
    } as CMSConfig);
    jitiImportMock.mockResolvedValue({ posts });

    await runSync({
      token: "tok",
      silent: true,
      json: true,
      cacheDir: ".cache",
    });

    const output = JSON.parse(
      logSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n"),
    );
    expect(output.ok).toBe(true);
    const files = await fs.readdir(path.join(tmpDir, ".cache"));
    expect(files.some((f) => f.includes("entry"))).toBe(true);
  });
});
