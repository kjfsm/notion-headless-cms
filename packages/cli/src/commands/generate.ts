import fs from "node:fs/promises";
import path from "node:path";
import { CMSError } from "@notion-headless-cms/core";
import type { ResolvedCollection } from "../codegen.js";
import { generateSchemaFile } from "../codegen.js";
import { loadConfig } from "../config-loader.js";
import type { CollectionGenConfig } from "../index.js";
import {
  createNotionCLIClient,
  type NotionCLIClient,
} from "../notion-client.js";
import type { Reporter } from "./shared.js";
import { loadEnvFile, makeReporter, resolveToken } from "./shared.js";

export interface GenerateOptions {
  config?: string;
  token?: string;
  envFile?: string;
  silent?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

async function resolveCollection(
  name: string,
  collection: CollectionGenConfig,
  client: NotionCLIClient,
  reporter: Reporter,
): Promise<ResolvedCollection> {
  if (!collection.databaseId && !collection.dbName) {
    throw new CMSError({
      code: "cli/config_invalid",
      message: `[${name}] databaseId または dbName のいずれかを指定してください。`,
      context: { operation: "resolveCollection", collection: name },
    });
  }

  let resolvedId = collection.databaseId;
  if (!resolvedId && collection.dbName) {
    reporter.debug(`[${name}] dbName "${collection.dbName}" を検索中...`);
    const found = await client.resolveId(collection.dbName);
    if (!found) {
      throw new CMSError({
        code: "cli/notion_api_failed",
        message:
          `[${name}] データベース "${collection.dbName}" と完全一致する DB が見つかりませんでした。\n` +
          "・Notion トークンにそのデータベースへのアクセス権限があるか確認してください。\n" +
          "・DB 名が完全に一致しているか確認してください (前後の空白や全角/半角違いも不一致になります)。",
        context: {
          operation: "resolveCollection",
          collection: name,
          dbName: collection.dbName,
        },
      });
    }
    resolvedId = found;
    reporter.debug(`[${name}] dbName 解決: ${resolvedId}`);
  }

  reporter.debug(`[${name}] DataSource 取得中: ${resolvedId}`);
  const retrieved = await client.retrieveDataSource(resolvedId as string);
  const retrievedTitle = retrieved.title.map((t) => t.plain_text).join("");
  const dbName = collection.dbName ?? retrievedTitle ?? (resolvedId as string);

  return {
    name,
    config: collection,
    id: resolvedId as string,
    dbName,
    properties: retrieved.properties,
  };
}

export async function runGenerate(opts: GenerateOptions): Promise<void> {
  const reporter = makeReporter(opts);
  await loadEnvFile(opts.envFile, reporter);

  const configPath = path.resolve(
    process.cwd(),
    opts.config ?? "nhc.config.ts",
  );
  reporter.info(`設定ファイルを読み込み中: ${configPath}`);
  const config = await loadConfig(configPath);

  const token = resolveToken(opts.token, config.notionToken, "runGenerate");
  reporter.debug(
    `Notion トークンを解決しました (length=${token.length}, prefix=${token.slice(0, 4)}...)`,
  );
  const notionClient = createNotionCLIClient(token);

  const collectionEntries = Object.entries(config.collections);
  if (collectionEntries.length === 0) {
    throw new CMSError({
      code: "cli/config_invalid",
      message:
        "nhc.config.ts の collections に少なくとも 1 件のコレクションを定義してください。",
      context: { operation: "runGenerate" },
    });
  }

  const total = collectionEntries.length;
  reporter.info(`${total} 件のコレクションを解決中...`);
  const resolved: ResolvedCollection[] = [];
  let totalProps = 0;
  for (let i = 0; i < collectionEntries.length; i++) {
    const [name, col] = collectionEntries[i] as [string, CollectionGenConfig];
    const idx = i + 1;
    reporter.info(`  → [${idx}/${total}] ${name} を解決中...`);
    const r = await resolveCollection(name, col, notionClient, reporter);
    const propCount = Object.keys(r.properties).length;
    totalProps += propCount;
    reporter.info(
      `  ✓ [${idx}/${total}] ${name}: ${r.id} (${r.dbName}, ${propCount} プロパティ)`,
    );
    if (opts.verbose || opts.debug) {
      const propNames = Object.keys(r.properties).join(", ");
      reporter.debug(`[${name}] プロパティ: ${propNames}`);
    }
    resolved.push(r);
  }

  const code = generateSchemaFile(resolved);
  const outputPath = path.resolve(process.cwd(), config.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, code, "utf-8");

  reporter.info(`\n生成完了: ${outputPath}`);
  reporter.info(
    `  ${total} コレクション / ${totalProps} プロパティ / ${code.length} バイト`,
  );
  reporter.info(
    '次のステップ: import { schema } from "./generated/nhc.schema"; を notionSource({ schema }) に渡し、createClient({ sources: { notion: ... } }) で CMS クライアントを構築してください。',
  );
}
