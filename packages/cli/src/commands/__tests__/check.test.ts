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

const jitiImportMock = vi.fn();
vi.mock("jiti", () => ({
  createJiti: () => ({ import: jitiImportMock }),
}));

const { runCheck } = await import("../check.js");

function makeDataSource(properties: Record<string, unknown>) {
  return { properties } as never;
}

describe("runCheck", () => {
  let tmpDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhc-check-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    loadConfigMock.mockReset();
    resolveIdMock.mockReset();
    retrieveDataSourceMock.mockReset();
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
    await expect(
      runCheck({ token: "tok", silent: true }),
    ).rejects.toMatchObject({ code: "cli/config_invalid" });
  });

  it("drift が無ければ exitCode を変更しない", async () => {
    loadConfigMock.mockResolvedValue({
      schemaModule: "src/schema.ts",
      collections: { posts: { databaseId: "ds-posts" } },
    } as CMSConfig);
    jitiImportMock.mockResolvedValue({
      posts: { properties: { title: { kind: "title" } } },
    });
    retrieveDataSourceMock.mockResolvedValue(
      makeDataSource({ title: { type: "title" } }),
    );

    await runCheck({ token: "tok", silent: true });

    expect(process.exitCode).toBeUndefined();
  });

  it("drift があれば exitCode を 1 にする", async () => {
    loadConfigMock.mockResolvedValue({
      schemaModule: "src/schema.ts",
      collections: { posts: { databaseId: "ds-posts" } },
    } as CMSConfig);
    jitiImportMock.mockResolvedValue({
      posts: { properties: { title: { kind: "title" } } },
    });
    // Notion 側に新しいプロパティが増えている(drift)。
    retrieveDataSourceMock.mockResolvedValue(
      makeDataSource({
        title: { type: "title" },
        newField: { type: "rich_text" },
      }),
    );

    await runCheck({ token: "tok", silent: true });

    expect(process.exitCode).toBe(1);
  });

  it("--json 指定時は JSON で結果を出力する", async () => {
    loadConfigMock.mockResolvedValue({
      schemaModule: "src/schema.ts",
      collections: { posts: { databaseId: "ds-posts" } },
    } as CMSConfig);
    jitiImportMock.mockResolvedValue({
      posts: { properties: { title: { kind: "title" } } },
    });
    retrieveDataSourceMock.mockResolvedValue(
      makeDataSource({ title: { type: "title" } }),
    );

    await runCheck({ token: "tok", json: true, silent: true });

    const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n");
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
  });

  it("スキーマモジュールに対応する export が無ければ CMSError(cli/schema_invalid) を投げる", async () => {
    loadConfigMock.mockResolvedValue({
      schemaModule: "src/schema.ts",
      collections: { posts: { databaseId: "ds-posts" } },
    } as CMSConfig);
    jitiImportMock.mockResolvedValue({});

    await expect(
      runCheck({ token: "tok", silent: true }),
    ).rejects.toMatchObject({ code: "cli/schema_invalid" });
  });

  it("dbName が解決できなければ CMSError(cli/notion_api_failed) を投げる", async () => {
    loadConfigMock.mockResolvedValue({
      schemaModule: "src/schema.ts",
      collections: { posts: { dbName: "存在しないDB" } },
    } as CMSConfig);
    jitiImportMock.mockResolvedValue({
      posts: { properties: { title: { kind: "title" } } },
    });
    resolveIdMock.mockResolvedValue(null);

    await expect(
      runCheck({ token: "tok", silent: true }),
    ).rejects.toMatchObject({ code: "cli/notion_api_failed" });
  });
});
