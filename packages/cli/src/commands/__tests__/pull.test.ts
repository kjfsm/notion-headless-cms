import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CMSConfig } from "../../index.js";

const loadConfigMock = vi.fn<() => Promise<CMSConfig>>();
vi.mock("../../config-loader.js", () => ({ loadConfig: loadConfigMock }));

const resolveIdMock = vi.fn();
const retrieveDataSourceMock = vi.fn();
vi.mock("../../notion-client.js", () => ({
  createNotionCLIClient: () => ({
    resolveId: resolveIdMock,
    retrieveDataSource: retrieveDataSourceMock,
  }),
}));

const { runPull } = await import("../pull.js");

function makeDataSource(properties: Record<string, unknown>) {
  return { properties } as never;
}

describe("runPull", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhc-pull-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    loadConfigMock.mockReset();
    resolveIdMock.mockReset();
    retrieveDataSourceMock.mockReset();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("v3.collections 未定義なら CMSError(cli/config_invalid) を投げる", async () => {
    loadConfigMock.mockResolvedValue({
      output: "x",
      collections: {},
    } as CMSConfig);
    await expect(runPull({ token: "tok", silent: true })).rejects.toMatchObject(
      { code: "cli/config_invalid" },
    );
  });

  it("dataSourceId 指定のコレクションを解決して雛形を出力する", async () => {
    loadConfigMock.mockResolvedValue({
      output: "x",
      collections: {},
      v3: {
        collections: { posts: { databaseId: "ds-posts" } },
      },
    } as CMSConfig);
    retrieveDataSourceMock.mockResolvedValue(
      makeDataSource({
        Title: { type: "title" },
        Slug: { type: "rich_text" },
      }),
    );

    await runPull({ token: "tok", silent: true });

    expect(resolveIdMock).not.toHaveBeenCalled();
    expect(retrieveDataSourceMock).toHaveBeenCalledWith("ds-posts");
    const output = await fs.readFile(
      path.join(tmpDir, "src/collections/posts.ts"),
      "utf-8",
    );
    expect(output).toContain("defineCollection");
    expect(output).toContain('dataSourceId: "ds-posts"');
  });

  it("dbName 指定は resolveId で dataSourceId に解決する", async () => {
    loadConfigMock.mockResolvedValue({
      output: "x",
      collections: {},
      v3: { collections: { posts: { dbName: "ブログ記事DB" } } },
    } as CMSConfig);
    resolveIdMock.mockResolvedValue("resolved-ds-id");
    retrieveDataSourceMock.mockResolvedValue(makeDataSource({}));

    await runPull({ token: "tok", silent: true });

    expect(resolveIdMock).toHaveBeenCalledWith("ブログ記事DB");
    expect(retrieveDataSourceMock).toHaveBeenCalledWith("resolved-ds-id");
  });

  it("dbName が解決できなければ CMSError(cli/notion_api_failed) を投げる", async () => {
    loadConfigMock.mockResolvedValue({
      output: "x",
      collections: {},
      v3: { collections: { posts: { dbName: "存在しないDB" } } },
    } as CMSConfig);
    resolveIdMock.mockResolvedValue(null);

    await expect(runPull({ token: "tok", silent: true })).rejects.toMatchObject(
      { code: "cli/notion_api_failed" },
    );
  });

  it("既存ファイルは上書きしない(生成物の所有権はユーザー)", async () => {
    loadConfigMock.mockResolvedValue({
      output: "x",
      collections: {},
      v3: { collections: { posts: { databaseId: "ds-posts" } } },
    } as CMSConfig);
    retrieveDataSourceMock.mockResolvedValue(makeDataSource({}));

    const scaffoldDir = path.join(tmpDir, "src/collections");
    await fs.mkdir(scaffoldDir, { recursive: true });
    await fs.writeFile(
      path.join(scaffoldDir, "posts.ts"),
      "// user edited\n",
      "utf-8",
    );

    await runPull({ token: "tok", silent: true });

    const output = await fs.readFile(
      path.join(scaffoldDir, "posts.ts"),
      "utf-8",
    );
    expect(output).toBe("// user edited\n");
  });

  it("--scaffold-dir で出力先を上書きできる", async () => {
    loadConfigMock.mockResolvedValue({
      output: "x",
      collections: {},
      v3: { collections: { posts: { databaseId: "ds-posts" } } },
    } as CMSConfig);
    retrieveDataSourceMock.mockResolvedValue(makeDataSource({}));

    await runPull({
      token: "tok",
      silent: true,
      scaffoldDir: "custom/dir",
    });

    const output = await fs.readFile(
      path.join(tmpDir, "custom/dir/posts.ts"),
      "utf-8",
    );
    expect(output).toContain("defineCollection");
  });
});
