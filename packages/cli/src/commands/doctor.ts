import fs from "node:fs/promises";
import path from "node:path";

import type { PropertyMap } from "@notion-headless-cms/cms";
import { mapPropertyValue } from "@notion-headless-cms/cms";

import { loadConfig } from "../config-loader.js";
import type { DoctorInput } from "../doctor.js";
import { runDoctorChecks } from "../doctor.js";
import type { CMSConfig } from "../index.js";
import type { NotionCLIClient } from "../notion-client.js";
import { createNotionCLIClient } from "../notion-client.js";
import {
  loadEnvFile,
  makeReporter,
  type Reporter,
  resolveDataSourceId,
  resolveToken,
} from "./shared.js";

export interface DoctorOptions {
  config?: string;
  token?: string;
  envFile?: string;
  /** wrangler 設定ファイルのパス(binding 宣言の静的チェック用)。既定 "wrangler.toml"。 */
  wranglerConfig?: string;
  /** デプロイ済み Worker が公開する同期統計エンドポイントの URL(任意)。 */
  statsUrl?: string;
  json?: boolean;
  silent?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

interface WranglerBindings {
  readonly d1: boolean;
  readonly r2: boolean;
  readonly durableObject: boolean;
}

/**
 * TOML のコメント行(`#` 始まり、前後の空白は無視)を取り除く。
 * `# kv_namespaces = [...]` のようにコメントアウトされた宣言を正規表現が
 * 誤って「宣言あり」と判定しないようにするため。
 */
function stripTomlComments(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}

/**
 * wrangler.toml のテキストを見て D1/R2/DO の binding 宣言有無を静的にチェックする。
 * 実際のバインディング疎通(ランタイム)ではなく設定ファイル上の宣言確認に留める
 * (`doctor.ts` の remediation メッセージが想定する対処 = wrangler.toml への追記)。
 */
async function detectWranglerBindings(wranglerPath: string): Promise<WranglerBindings> {
  let text: string;
  try {
    text = await fs.readFile(wranglerPath, "utf-8");
  } catch {
    return { d1: false, r2: false, durableObject: false };
  }
  text = stripTomlComments(text);
  return {
    d1: /d1_databases\s*=/.test(text),
    r2: /r2_buckets\s*=/.test(text),
    durableObject: /\[\[durable_objects\.bindings]]/.test(text),
  };
}

/**
 * `schemaModule` から各コレクションの slug プロパティを読み取り、Notion 側の
 * 全ページを問い合わせて実際の slug 値を集める(slug 重複検出用)。
 * `schemaModule`/`slug` 未設定のコレクションはスキップする(page id で一意なため)。
 */
async function collectSlugs(
  config: CMSConfig,
  notionClient: NotionCLIClient,
  reporter: Reporter,
): Promise<readonly { collection: string; slug: string }[]> {
  if (!config.schemaModule) return [];

  const schemaModulePath = path.resolve(process.cwd(), config.schemaModule);
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url);
  const schemaModule = await jiti.import<Record<string, unknown>>(schemaModulePath);

  const collected: { collection: string; slug: string }[] = [];
  for (const [name, source] of Object.entries(config.collections)) {
    const exported = schemaModule[name];
    if (!exported || typeof exported !== "object" || !("properties" in exported)) {
      reporter.debug(
        `[${name}] スキーマモジュールに export が見つからないため slug 重複チェックをスキップします`,
      );
      continue;
    }
    const def = exported as {
      readonly slug?: string;
      readonly properties: PropertyMap;
    };
    if (!def.slug) continue;
    const propDef = def.properties[def.slug];
    if (!propDef) continue;
    const notionName = propDef.notion ?? def.slug;

    const dataSourceId = await resolveDataSourceId(
      name,
      source,
      notionClient,
      reporter,
      "runDoctor",
    );
    const pages = await notionClient.queryAllPages(dataSourceId);
    for (const page of pages) {
      const raw = (page.properties as Record<string, unknown>)[notionName];
      const value = mapPropertyValue(propDef.kind, raw as Parameters<typeof mapPropertyValue>[1]);
      if (typeof value === "string" && value.length > 0) {
        collected.push({ collection: name, slug: value });
      }
    }
  }
  return collected;
}

const STATUS_ICON: Record<string, string> = { ok: "✓", warn: "△", error: "✗" };

/**
 * `nhc doctor`: binding 疎通(静的宣言)・webhook 設定・token 権限・同期状態・
 * slug 重複を診断する(#446)。判定ロジック自体は `doctor.ts` の純関数
 * `runDoctorChecks` に委譲し、ここでは入力(`DoctorInput`)の収集と結果表示を行う。
 */
export async function runDoctor(opts: DoctorOptions): Promise<void> {
  const reporter = makeReporter(opts);
  await loadEnvFile(opts.envFile, reporter);

  const configPath = path.resolve(process.cwd(), opts.config ?? "nhc.config.ts");
  const config = await loadConfig(configPath);
  const token = resolveToken(opts.token, config.notionToken, "runDoctor");
  const notionClient = createNotionCLIClient(token);

  const wranglerPath = path.resolve(process.cwd(), opts.wranglerConfig ?? "wrangler.toml");
  const bindings = await detectWranglerBindings(wranglerPath);

  const webhookSecretConfigured = Boolean(process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN);

  let tokenValid: boolean | "unknown" = "unknown";
  try {
    tokenValid = await notionClient.validateToken();
  } catch (err) {
    reporter.debug(
      `token 検証をスキップしました: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let syncStats: DoctorInput["syncStats"] = {
    lastSyncAt: null,
    failureCount: 0,
  };
  if (opts.statsUrl) {
    try {
      const res = await fetch(opts.statsUrl);
      const data = (await res.json()) as {
        lastSyncAt?: string | null;
        failureCount?: number;
      };
      syncStats = {
        lastSyncAt: data.lastSyncAt ?? null,
        failureCount: data.failureCount ?? 0,
      };
    } catch (err) {
      reporter.debug(
        `--stats-url からの取得に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const slugs = await collectSlugs(config, notionClient, reporter);

  const input: DoctorInput = {
    bindings,
    webhookSecretConfigured,
    tokenValid,
    syncStats,
    slugs,
  };
  const report = runDoctorChecks(input);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const check of report.checks) {
      reporter.info(`${STATUS_ICON[check.status]} [${check.name}] ${check.message}`);
      if (check.remediation) reporter.info(`    → ${check.remediation}`);
    }
    reporter.info(report.ok ? "\n総合判定: OK" : "\n総合判定: 要対応");
  }

  if (!report.ok) {
    process.exitCode = 1;
  }
}
