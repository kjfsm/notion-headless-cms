import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runInit } from "../commands/init.js";

let tmpDir: string;
let originalCwd: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhc-init-test-"));
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("runInit", () => {
  it("nhc.config.ts に notionToken/schemaModule/collections を含める", async () => {
    await runInit({ silent: true });
    const content = await fs.readFile(path.join(tmpDir, "nhc.config.ts"), "utf-8");
    expect(content).toContain('import { defineConfig, env } from "@notion-headless-cms/cli"');
    expect(content).toContain('notionToken: env("NOTION_TOKEN")');
    expect(content).toContain('schemaModule: "src/schema.ts"');
    expect(content).toContain("dbName");
  });

  it("wrangler.toml・src/schema.ts・Hono マウントコード一式を生成する", async () => {
    await runInit({ silent: true });

    const wrangler = await fs.readFile(path.join(tmpDir, "wrangler.toml"), "utf-8");
    expect(wrangler).toContain('name = "');

    const schema = await fs.readFile(path.join(tmpDir, "src/schema.ts"), "utf-8");
    expect(schema).toContain("defineSchema");

    const doFile = await fs.readFile(path.join(tmpDir, "src/lib/do.ts"), "utf-8");
    expect(doFile).toContain("createSyncCoordinatorDO");
    expect(doFile).not.toContain("not implemented");

    const cmsFile = await fs.readFile(path.join(tmpDir, "src/lib/cms.ts"), "utf-8");
    expect(cmsFile).toContain("durableObjectSyncDelegate");

    const indexFile = await fs.readFile(path.join(tmpDir, "src/index.ts"), "utf-8");
    expect(indexFile).toContain("makeCms");
  });

  it("既存の追加ファイル(wrangler.toml 等)は --force でも上書きしない(生成物の所有権はユーザー)", async () => {
    await fs.writeFile(path.join(tmpDir, "wrangler.toml"), "# user edited\n", "utf-8");

    await runInit({ force: true, silent: true });

    const wrangler = await fs.readFile(path.join(tmpDir, "wrangler.toml"), "utf-8");
    expect(wrangler).toBe("# user edited\n");
  });

  it("nhc.config.ts が既に存在すると --force 無しではエラーになる", async () => {
    await fs.writeFile(path.join(tmpDir, "nhc.config.ts"), "existing", "utf-8");
    await expect(runInit({})).rejects.toThrow("--force");
  });

  it("--force を指定すると nhc.config.ts を上書きする", async () => {
    const outputPath = path.join(tmpDir, "nhc.config.ts");
    await fs.writeFile(outputPath, "existing content", "utf-8");

    await runInit({ force: true, silent: true });

    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain("defineConfig");
    expect(content).not.toBe("existing content");
  });

  it("--output で nhc.config.ts の出力先を変更できる", async () => {
    const outputPath = path.join(tmpDir, "config", "nhc.config.ts");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await runInit({ output: outputPath, silent: true });

    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain("defineConfig");
  });

  it("silent: true のときはコンソール出力をしない", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await runInit({ silent: true });
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
