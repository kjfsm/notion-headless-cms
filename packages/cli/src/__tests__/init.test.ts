import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInit } from "../commands/init.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nhc-init-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("runInit", () => {
  it("nhc.config.ts テンプレートを作成する", async () => {
    const outputPath = path.join(tmpDir, "nhc.config.ts");
    await runInit({ output: outputPath });

    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain('import "dotenv/config"');
    expect(content).toContain(
      'import { defineConfig, env } from "@notion-headless-cms/cli"',
    );
    expect(content).toContain('notionToken: env("NOTION_TOKEN")');
    expect(content).toContain("defineConfig(");
    expect(content).toContain("collections:");
  });

  it("デフォルトのファイル名は nhc.config.ts", async () => {
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await runInit({});
      const content = await fs.readFile(
        path.join(tmpDir, "nhc.config.ts"),
        "utf-8",
      );
      expect(content).toContain("defineConfig");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("ファイルが既に存在するとエラーをスローする", async () => {
    const outputPath = path.join(tmpDir, "nhc.config.ts");
    await fs.writeFile(outputPath, "existing content", "utf-8");

    await expect(runInit({ output: outputPath })).rejects.toThrow("--force");
  });

  it("--force を指定すると既存ファイルを上書きする", async () => {
    const outputPath = path.join(tmpDir, "nhc.config.ts");
    await fs.writeFile(outputPath, "existing content", "utf-8");

    await runInit({ output: outputPath, force: true });

    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain("defineConfig");
    expect(content).not.toBe("existing content");
  });

  it("サブディレクトリへの出力パスを受け付ける", async () => {
    const outputPath = path.join(tmpDir, "config", "nhc.config.ts");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await runInit({ output: outputPath });

    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain("defineConfig");
  });

  it("silent: true のときはコンソール出力をしない", async () => {
    const outputPath = path.join(tmpDir, "nhc.config.ts");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await runInit({ output: outputPath, silent: true });
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("生成されたテンプレートに dbName と publishedStatuses の例が含まれる", async () => {
    const outputPath = path.join(tmpDir, "nhc.config.ts");
    await runInit({ output: outputPath });

    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain("dbName");
    expect(content).toContain("publishedStatuses");
  });
});
