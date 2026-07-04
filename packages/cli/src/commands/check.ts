import path from "node:path";
import type { PropertyMap } from "@notion-headless-cms/cms";
import { CMSError } from "@notion-headless-cms/core";
import { loadConfig } from "../config-loader.js";
import {
  createNotionCLIClient,
  type NotionCLIClient,
} from "../notion-client.js";
import type { SchemaDrift } from "../v3/check.js";
import { diffSchema } from "../v3/check.js";
import type { Reporter } from "./shared.js";
import { loadEnvFile, makeReporter, resolveToken } from "./shared.js";

export interface CheckOptions {
  config?: string;
  token?: string;
  envFile?: string;
  json?: boolean;
  silent?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

interface CheckResult {
  readonly collection: string;
  readonly drift: SchemaDrift;
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
      context: { operation: "runCheck", collection: name },
    });
  }
  reporter.debug(`[${name}] dbName "${source.dbName}" を検索中...`);
  const found = await client.resolveId(source.dbName);
  if (!found) {
    throw new CMSError({
      code: "cli/notion_api_failed",
      message: `[${name}] データベース "${source.dbName}" と完全一致する DB が見つかりませんでした。`,
      context: {
        operation: "runCheck",
        collection: name,
        dbName: source.dbName,
      },
    });
  }
  return found;
}

function propertiesOf(
  schemaModule: Record<string, unknown>,
  name: string,
): PropertyMap {
  const exported = schemaModule[name];
  if (
    !exported ||
    typeof exported !== "object" ||
    !("properties" in exported)
  ) {
    throw new CMSError({
      code: "cli/schema_invalid",
      message: `[${name}] スキーマモジュールに defineCollection の export "${name}" が見つかりません。`,
      context: { operation: "runCheck", collection: name },
    });
  }
  return (exported as { properties: PropertyMap }).properties;
}

/**
 * `nhc check`: `v3.schemaModule`（ユーザーが書いた TS スキーマ）と実 Notion DB の
 * drift を検証する(CI 用)。drift 検出時は非ゼロ終了コードを返す。
 */
export async function runCheck(opts: CheckOptions): Promise<void> {
  const reporter = makeReporter(opts);
  await loadEnvFile(opts.envFile, reporter);

  const configPath = path.resolve(
    process.cwd(),
    opts.config ?? "nhc.config.ts",
  );
  const config = await loadConfig(configPath);

  const v3 = config.v3;
  if (!v3?.schemaModule || Object.keys(v3.collections).length === 0) {
    throw new CMSError({
      code: "cli/config_invalid",
      message:
        "nhc.config.ts に v3.schemaModule と v3.collections を定義してください。",
      context: { operation: "runCheck" },
    });
  }

  const token = resolveToken(opts.token, config.notionToken, "runCheck");
  const notionClient = createNotionCLIClient(token);

  const schemaModulePath = path.resolve(process.cwd(), v3.schemaModule);
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url);
  const schemaModule =
    await jiti.import<Record<string, unknown>>(schemaModulePath);

  const results: CheckResult[] = [];
  for (const [name, source] of Object.entries(v3.collections)) {
    const properties = propertiesOf(schemaModule, name);
    const dataSourceId = await resolveDataSourceId(
      name,
      source,
      notionClient,
      reporter,
    );
    const dataSource = await notionClient.retrieveDataSource(dataSourceId);
    results.push({
      collection: name,
      drift: diffSchema(dataSource, properties, source.fieldMappings),
    });
  }

  const hasDrift = results.some((r) => r.drift.hasDrift);

  if (opts.json) {
    console.log(JSON.stringify({ ok: !hasDrift, results }, null, 2));
  } else {
    for (const { collection, drift } of results) {
      if (!drift.hasDrift) {
        reporter.info(`✓ [${collection}] drift なし`);
        continue;
      }
      reporter.info(`✗ [${collection}] drift 検出:`);
      for (const change of drift.changes) {
        reporter.info(`    - ${change.kind}: ${change.detail}`);
      }
    }
  }

  if (hasDrift) {
    process.exitCode = 1;
  }
}
