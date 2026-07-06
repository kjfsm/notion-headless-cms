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

  it("生成されたテンプレートに dbName が含まれ、published は createCMS 側へ案内する", async () => {
    const outputPath = path.join(tmpDir, "nhc.config.ts");
    await runInit({ output: outputPath });

    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain("dbName");
    // 公開ステータスは振る舞いなので config には書かず createCMS 側へ案内する
    expect(content).not.toContain("publishedStatuses");
    expect(content).toContain("createCMS");
  });

  it("template: cloudflare-react-router は output を app/generated にし dotenv を入れない", async () => {
    const outputPath = path.join(tmpDir, "nhc.config.ts");
    await runInit({ output: outputPath, template: "cloudflare-react-router" });

    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain('output: "./app/generated/nhc.ts"');
    expect(content).not.toContain('import "dotenv/config"');
  });

  it("template: 未知の名前はエラーをスローする", async () => {
    const outputPath = path.join(tmpDir, "nhc.config.ts");
    await expect(
      runInit({ output: outputPath, template: "does-not-exist" }),
    ).rejects.toThrow("未知のテンプレート");
  });

  it("template 指定時は次のステップに example への導線を出す", async () => {
    const outputPath = path.join(tmpDir, "nhc.config.ts");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await runInit({ output: outputPath, template: "cloudflare-react-router" });
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain("examples/cloudflare-react-router");
    logSpy.mockRestore();
  });

  describe("template: cloudflare-v3", () => {
    it("nhc.config.ts に v3.schemaModule/v3.collections を含める", async () => {
      const originalCwd = process.cwd();
      process.chdir(tmpDir);
      try {
        await runInit({ template: "cloudflare-v3" });
        const content = await fs.readFile(
          path.join(tmpDir, "nhc.config.ts"),
          "utf-8",
        );
        expect(content).toContain('schemaModule: "src/schema.ts"');
        expect(content).toContain("v3:");
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("wrangler.toml・src/schema.ts・Hono マウントコード一式を生成する", async () => {
      const originalCwd = process.cwd();
      process.chdir(tmpDir);
      try {
        await runInit({ template: "cloudflare-v3", silent: true });

        const wrangler = await fs.readFile(
          path.join(tmpDir, "wrangler.toml"),
          "utf-8",
        );
        expect(wrangler).toContain('name = "');

        const schema = await fs.readFile(
          path.join(tmpDir, "src/schema.ts"),
          "utf-8",
        );
        expect(schema).toContain("defineSchema");

        const doFile = await fs.readFile(
          path.join(tmpDir, "src/lib/do.ts"),
          "utf-8",
        );
        expect(doFile).toContain("createSyncCoordinatorDO");
        expect(doFile).not.toContain("not implemented");

        const cmsFile = await fs.readFile(
          path.join(tmpDir, "src/lib/cms.ts"),
          "utf-8",
        );
        expect(cmsFile).toContain("durableObjectSyncDelegate");

        const indexFile = await fs.readFile(
          path.join(tmpDir, "src/index.ts"),
          "utf-8",
        );
        expect(indexFile).toContain("makeCms");
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("既存の追加ファイル(wrangler.toml 等)は --force でも上書きしない(生成物の所有権はユーザー)", async () => {
      const originalCwd = process.cwd();
      process.chdir(tmpDir);
      try {
        await fs.writeFile(
          path.join(tmpDir, "wrangler.toml"),
          "# user edited\n",
          "utf-8",
        );

        await runInit({ template: "cloudflare-v3", force: true, silent: true });

        const wrangler = await fs.readFile(
          path.join(tmpDir, "wrangler.toml"),
          "utf-8",
        );
        expect(wrangler).toBe("# user edited\n");
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("nhc.config.ts が既に存在すると --force 無しではエラーになる", async () => {
      const originalCwd = process.cwd();
      process.chdir(tmpDir);
      try {
        await fs.writeFile(
          path.join(tmpDir, "nhc.config.ts"),
          "existing",
          "utf-8",
        );
        await expect(runInit({ template: "cloudflare-v3" })).rejects.toThrow(
          "--force",
        );
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
