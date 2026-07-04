import fs from "node:fs/promises";
import path from "node:path";
import { CMSError } from "@notion-headless-cms/core";
import { loadConfig } from "../config-loader.js";
import { fileExists } from "../fs-utils.js";
import {
  createNotionCLIClient,
  type NotionCLIClient,
} from "../notion-client.js";
import { generateCollectionScaffold } from "../v3/pull.js";
import type { Reporter } from "./shared.js";
import { loadEnvFile, makeReporter, resolveToken } from "./shared.js";

export interface PullOptions {
  config?: string;
  token?: string;
  envFile?: string;
  scaffoldDir?: string;
  silent?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

async function resolveDataSourceId(
  name: string,
  source: { databaseId?: string; dbName?: string },
  client: NotionCLIClient,
  reporter: Reporter,
): Promise<string> {
  if (source.databaseId) return source.databaseId;
  if (!source.dbName) {
    throw new CMSError({
      code: "cli/config_invalid",
      message: `[${name}] v3.collections["${name}"] に databaseId または dbName のいずれかを指定してください。`,
      context: { operation: "runPull", collection: name },
    });
  }
  reporter.debug(`[${name}] dbName "${source.dbName}" を検索中...`);
  const found = await client.resolveId(source.dbName);
  if (!found) {
    throw new CMSError({
      code: "cli/notion_api_failed",
      message: `[${name}] データベース "${source.dbName}" と完全一致する DB が見つかりませんでした。`,
      context: {
        operation: "runPull",
        collection: name,
        dbName: source.dbName,
      },
    });
  }
  return found;
}

/**
 * `nhc pull`: `nhc.config.ts` の `v3.collections` を introspect し、
 * `defineCollection` の雛形 TS コードを `v3.scaffoldDir` に出力する。
 * codegen（v2）と異なり生成物の所有権はユーザーに移るため、既存ファイルは上書きしない。
 */
export async function runPull(opts: PullOptions): Promise<void> {
  const reporter = makeReporter(opts);
  await loadEnvFile(opts.envFile, reporter);

  const configPath = path.resolve(
    process.cwd(),
    opts.config ?? "nhc.config.ts",
  );
  reporter.info(`設定ファイルを読み込み中: ${configPath}`);
  const config = await loadConfig(configPath);

  const v3 = config.v3;
  if (!v3 || Object.keys(v3.collections).length === 0) {
    throw new CMSError({
      code: "cli/config_invalid",
      message:
        'nhc.config.ts に v3.collections を 1 件以上定義してください（例: v3: { collections: { posts: { dbName: "..." } } } ）。',
      context: { operation: "runPull" },
    });
  }

  const token = resolveToken(opts.token, config.notionToken, "runPull");
  const notionClient = createNotionCLIClient(token);
  const scaffoldDir = path.resolve(
    process.cwd(),
    opts.scaffoldDir ?? v3.scaffoldDir ?? "src/collections",
  );
  await fs.mkdir(scaffoldDir, { recursive: true });

  const entries = Object.entries(v3.collections);
  reporter.info(`${entries.length} 件のコレクションを解決中...`);
  let generated = 0;
  let skipped = 0;
  for (const [name, source] of entries) {
    const dataSourceId = await resolveDataSourceId(
      name,
      source,
      notionClient,
      reporter,
    );
    const dataSource = await notionClient.retrieveDataSource(dataSourceId);
    const code = generateCollectionScaffold(dataSource, {
      collectionName: name,
      dataSourceId,
      fieldMappings: source.fieldMappings,
    });

    const outputPath = path.join(scaffoldDir, `${name}.ts`);
    if (await fileExists(outputPath)) {
      reporter.info(
        `  skip [${name}]: ${outputPath} は既に存在します（上書きしません）`,
      );
      skipped++;
      continue;
    }
    await fs.writeFile(outputPath, code, "utf-8");
    reporter.info(`  ✓ [${name}]: ${outputPath} を生成しました`);
    generated++;
  }

  reporter.info(`\n完了: 生成 ${generated} 件 / スキップ ${skipped} 件`);
}
