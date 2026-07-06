import path from "node:path";
import type { CollectionDef } from "@notion-headless-cms/cms";
import { CMSError, createCMS, defineSchema } from "@notion-headless-cms/cms";
import { fileBlobStore, fileDocStore } from "@notion-headless-cms/cms/node";
import { loadConfig } from "../config-loader.js";
import { runSyncCommand } from "../sync-command.js";
import { loadEnvFile, makeReporter, resolveToken } from "./shared.js";

export interface SyncOptions {
  config?: string;
  token?: string;
  envFile?: string;
  /** マテリアライズ先のローカルディレクトリ。既定 ".nhc-cache"。 */
  cacheDir?: string;
  json?: boolean;
  silent?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

/**
 * `nhc sync`: `schemaModule` の全コレクションをローカルファイルストア
 * (`cacheDir`)へ同期する(初回 kick 経路、#446)。KV/R2 への実書き込みは行わない
 * (無料プランの REST 経由書き込みは将来の `nhc warm` の役目)。
 */
export async function runSync(opts: SyncOptions): Promise<void> {
  const reporter = makeReporter(opts);
  await loadEnvFile(opts.envFile, reporter);

  const configPath = path.resolve(
    process.cwd(),
    opts.config ?? "nhc.config.ts",
  );
  const config = await loadConfig(configPath);

  if (!config.schemaModule || Object.keys(config.collections).length === 0) {
    throw new CMSError({
      code: "cli/config_invalid",
      message:
        "nhc.config.ts に schemaModule と collections を定義してください。",
      context: { operation: "runSync" },
    });
  }

  const token = resolveToken(opts.token, config.notionToken, "runSync");

  const schemaModulePath = path.resolve(process.cwd(), config.schemaModule);
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url);
  const schemaModule =
    await jiti.import<Record<string, unknown>>(schemaModulePath);

  const collections: Record<string, CollectionDef> = {};
  for (const name of Object.keys(config.collections)) {
    const exported = schemaModule[name];
    if (
      !exported ||
      typeof exported !== "object" ||
      !("properties" in exported)
    ) {
      throw new CMSError({
        code: "cli/schema_invalid",
        message: `[${name}] スキーマモジュールに defineCollection の export "${name}" が見つかりません。`,
        context: { operation: "runSync", collection: name },
      });
    }
    collections[name] = exported as CollectionDef;
  }

  const cacheDir = path.resolve(process.cwd(), opts.cacheDir ?? ".nhc-cache");
  reporter.info(`ローカルキャッシュへ同期します: ${cacheDir}`);

  const cms = createCMS({
    schema: defineSchema(collections),
    notion: { token },
    stores: { docs: fileDocStore(cacheDir), blobs: fileBlobStore(cacheDir) },
  });

  const result = await runSyncCommand(cms.sync, (state) => {
    reporter.debug(
      `cursor=${state.cursor ?? "(完了)"} failures=${state.failures.length}`,
    );
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    reporter.info(`✓ 同期完了(最終同期: ${result.state.lastSyncAt ?? "-"})`);
  } else {
    reporter.info(`✗ 同期完了(失敗 ${result.state.failures.length} 件):`);
    for (const failure of result.state.failures.slice(-10)) {
      reporter.info(`    - ${failure.slug}: ${failure.message}`);
    }
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}
