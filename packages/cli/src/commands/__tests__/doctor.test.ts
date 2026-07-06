import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CMSConfig } from "../../index.js";

const loadConfigMock = vi.fn<() => Promise<CMSConfig>>();
vi.mock("../../config-loader.js", () => ({ loadConfig: loadConfigMock }));

const validateTokenMock = vi.fn();
const queryAllPagesMock = vi.fn();
const resolveIdMock = vi.fn();
vi.mock("../../notion-client.js", () => ({
  createNotionCLIClient: () => ({
    resolveId: resolveIdMock,
    retrieveDataSource: vi.fn(),
    validateToken: validateTokenMock,
    queryAllPages: queryAllPagesMock,
  }),
}));

const jitiImportMock = vi.fn();
vi.mock("jiti", () => ({
  createJiti: () => ({ import: jitiImportMock }),
}));

const { runDoctor } = await import("../doctor.js");

const WRANGLER_TOML = `
name = "example"
kv_namespaces = [{ binding = "DOC_INDEX", id = "abc" }]
r2_buckets = [{ binding = "ENTRY_BUCKET", bucket_name = "abc" }]

[[durable_objects.bindings]]
name = "SYNC_COORDINATOR"
class_name = "SyncCoordinatorDO"
`;

function page(slug: string): unknown {
  return {
    object: "page",
    id: `page-${slug}`,
    properties: {
      slug: { type: "rich_text", rich_text: [{ plain_text: slug }] },
    },
  };
}

describe("runDoctor", () => {
  let tmpDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhc-doctor-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    loadConfigMock.mockReset();
    validateTokenMock.mockReset();
    queryAllPagesMock.mockReset().mockResolvedValue([]);
    resolveIdMock.mockReset();
    jitiImportMock.mockReset();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    process.exitCode = undefined;
    delete process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("wrangler.toml に binding が揃っていれば ok として報告する", async () => {
    await fs.writeFile(path.join(tmpDir, "wrangler.toml"), WRANGLER_TOML);
    loadConfigMock.mockResolvedValue({
      collections: {},
    } as CMSConfig);
    validateTokenMock.mockResolvedValue(true);
    process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = "secret";

    await runDoctor({ token: "tok", silent: true, json: true });

    const output = JSON.parse(logSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n"));
    expect(output.ok).toBe(true);
    expect(process.exitCode).toBeUndefined();
  });

  it("コメントアウトされた binding 宣言は「宣言あり」と誤検出しない", async () => {
    const commentedOutToml = `
name = "example"
# kv_namespaces = [{ binding = "DOC_INDEX", id = "abc" }]
  # r2_buckets = [{ binding = "ENTRY_BUCKET", bucket_name = "abc" }]

# [[durable_objects.bindings]]
# name = "SYNC_COORDINATOR"
# class_name = "SyncCoordinatorDO"
`;
    await fs.writeFile(path.join(tmpDir, "wrangler.toml"), commentedOutToml);
    loadConfigMock.mockResolvedValue({
      collections: {},
    } as CMSConfig);
    validateTokenMock.mockResolvedValue(true);

    await runDoctor({ token: "tok", silent: true, json: true });

    const output = JSON.parse(logSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n"));
    expect(output.ok).toBe(false);
    const bindingChecks = output.checks.filter((c: { name: string }) => c.name.endsWith("binding"));
    expect(bindingChecks.every((c: { status: string }) => c.status === "error")).toBe(true);
  });

  it("wrangler.toml が無ければ KV/R2/DO binding をすべて error として報告する", async () => {
    loadConfigMock.mockResolvedValue({
      collections: {},
    } as CMSConfig);
    validateTokenMock.mockResolvedValue(true);

    await runDoctor({ token: "tok", silent: true, json: true });

    const output = JSON.parse(logSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n"));
    expect(output.ok).toBe(false);
    expect(process.exitCode).toBe(1);
    const bindingChecks = output.checks.filter((c: { name: string }) => c.name.endsWith("binding"));
    expect(bindingChecks.every((c: { status: string }) => c.status === "error")).toBe(true);
  });

  it("token 検証が例外を投げても doctor 自体は失敗せず unknown として扱う", async () => {
    await fs.writeFile(path.join(tmpDir, "wrangler.toml"), WRANGLER_TOML);
    loadConfigMock.mockResolvedValue({
      collections: {},
    } as CMSConfig);
    validateTokenMock.mockRejectedValue(new Error("network down"));

    await runDoctor({ token: "tok", silent: true, json: true });

    const output = JSON.parse(logSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n"));
    const tokenCheck = output.checks.find((c: { name: string }) => c.name === "Notion token");
    expect(tokenCheck.status).toBe("warn");
  });

  it("--stats-url から同期統計を取得して報告する", async () => {
    await fs.writeFile(path.join(tmpDir, "wrangler.toml"), WRANGLER_TOML);
    loadConfigMock.mockResolvedValue({
      collections: {},
    } as CMSConfig);
    validateTokenMock.mockResolvedValue(true);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          lastSyncAt: "2026-01-01T00:00:00.000Z",
          failureCount: 2,
        }),
      ),
    );

    await runDoctor({
      token: "tok",
      silent: true,
      json: true,
      statsUrl: "https://example.com/stats",
    });

    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/stats");
    const output = JSON.parse(logSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n"));
    const failureCheck = output.checks.find((c: { name: string }) => c.name === "同期失敗");
    expect(failureCheck.message).toContain("2");
  });

  it("schemaModule の slug 重複を検出して error にする", async () => {
    await fs.writeFile(path.join(tmpDir, "wrangler.toml"), WRANGLER_TOML);
    loadConfigMock.mockResolvedValue({
      schemaModule: "src/schema.ts",
      collections: { posts: { databaseId: "ds-posts" } },
    } as CMSConfig);
    validateTokenMock.mockResolvedValue(true);
    jitiImportMock.mockResolvedValue({
      posts: {
        slug: "slug",
        properties: { slug: { kind: "richText" } },
      },
    });
    queryAllPagesMock.mockResolvedValue([page("dup"), page("dup")]);

    await runDoctor({ token: "tok", silent: true, json: true });

    const output = JSON.parse(logSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n"));
    const slugCheck = output.checks.find((c: { name: string }) => c.name === "slug 重複");
    expect(slugCheck.status).toBe("error");
    expect(output.ok).toBe(false);
  });
});
