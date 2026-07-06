import fs from "node:fs/promises";
import path from "node:path";
import { CMSError } from "@notion-headless-cms/cms";
import { loadConfig } from "../config-loader.js";
import { fileExists } from "../fs-utils.js";
import { createNotionCLIClient } from "../notion-client.js";
import { generateCollectionScaffold } from "../pull.js";
import {
  loadEnvFile,
  makeReporter,
  resolveDataSourceId,
  resolveToken,
} from "./shared.js";

export interface PullOptions {
  config?: string;
  token?: string;
  envFile?: string;
  scaffoldDir?: string;
  silent?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

/**
 * `nhc pull`: `nhc.config.ts` の `collections` を introspect し、
 * `defineCollection` の雛形 TS コードを `scaffoldDir` に出力する。
 * 生成物の所有権はユーザーに移るため、既存ファイルは上書きしない。
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

  if (Object.keys(config.collections).length === 0) {
    throw new CMSError({
      code: "cli/config_invalid",
      message:
        'nhc.config.ts に collections を 1 件以上定義してください（例: collections: { posts: { dbName: "..." } } ）。',
      context: { operation: "runPull" },
    });
  }

  const token = resolveToken(opts.token, config.notionToken, "runPull");
  const notionClient = createNotionCLIClient(token);
  const scaffoldDir = path.resolve(
    process.cwd(),
    opts.scaffoldDir ?? config.scaffoldDir ?? "src/collections",
  );
  await fs.mkdir(scaffoldDir, { recursive: true });

  const entries = Object.entries(config.collections);
  reporter.info(`${entries.length} 件のコレクションを解決中...`);
  let generated = 0;
  let skipped = 0;
  for (const [name, source] of entries) {
    const dataSourceId = await resolveDataSourceId(
      name,
      source,
      notionClient,
      reporter,
      "runPull",
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
