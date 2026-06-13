#!/usr/bin/env node
import { isCMSError } from "@notion-headless-cms/core";
import { Command } from "commander";
import { runGenerate } from "./commands/generate.js";
import { runInit } from "./commands/init.js";

const COMMON_PITFALLS = `
よくある詰まり所:
  ・NOTION_TOKEN 未設定: nhc.config.ts で env("NOTION_TOKEN") を使い、
    .dev.vars / .env / --env-file / --token のいずれかで値を渡してください。
  ・dbName が解決できない: Notion 側で前後の空白・全角半角を確認し、
    対象 DB がインテグレーションに接続されている (DB → … → Connections) かを確認してください。
  ・権限不足: Notion インテグレーションに対して DB の閲覧権限が付いているかを確認してください。
  ・--verbose で詳細ログ (Notion API レスポンス含む) が出ます。
`;

interface CommonOpts {
  verbose?: boolean;
  debug?: boolean;
}

/** コマンド実行を try/catch でラップし、失敗時は日本語メッセージで exit(1)。 */
function run<T>(
  fn: (opts: T) => Promise<void>,
): (opts: T & CommonOpts) => Promise<void> {
  return async (opts) => {
    try {
      await fn(opts);
    } catch (err) {
      // verbose / debug 時は CMSError の format() (nextSteps + docsUrl 付き) を、
      // それ以外は短いメッセージのみを出力する。
      if (isCMSError(err) && (opts.verbose || opts.debug)) {
        console.error("エラー:", err.format());
      } else {
        console.error(
          "エラー:",
          err instanceof Error ? err.message : String(err),
        );
      }
      if (opts.debug && err instanceof Error && err.stack) {
        console.error("\nスタックトレース:\n", err.stack);
        if (isCMSError(err) && err.cause instanceof Error && err.cause.stack) {
          console.error("\nCause:\n", err.cause.stack);
        }
      }
      if (!opts.verbose && !opts.debug) {
        console.error(
          "\nヒント: --verbose で次の対処手順、--debug でスタックトレースを表示します。",
        );
      }
      process.exit(1);
    }
  };
}

const program = new Command()
  .name("nhc")
  .description("notion-headless-cms CLI")
  .version("0.1.0")
  .addHelpText("afterAll", COMMON_PITFALLS);

program
  .command("init")
  .description("nhc.config.ts のテンプレートを生成します")
  .option("-o, --output <path>", "出力先ファイルパス", "nhc.config.ts")
  .option(
    "-t, --template <name>",
    "ランタイム別テンプレート (node / cloudflare-react-router / cloudflare-hono / next)",
    "node",
  )
  .option("-f, --force", "既存ファイルを上書きする")
  .option("-s, --silent", "ログ出力を抑制する")
  .option("-v, --verbose", "詳細ログを出力する")
  .option("--debug", "スタックトレースを含む最大詳細ログを出力する")
  .action(run(runInit));

program
  .command("generate")
  .description(
    "nhc.config.ts を読み込み、Notion DB の定義からスキーマファイルを生成します",
  )
  .option("-c, --config <path>", "設定ファイルのパス", "nhc.config.ts")
  .option(
    "-t, --token <token>",
    "Notion API トークン（省略時は NOTION_TOKEN 環境変数を使用）",
  )
  .option(
    "-e, --env-file <path>",
    "環境変数ファイルのパス（例: .dev.vars, .env.local）",
  )
  .option("-s, --silent", "ログ出力を抑制する")
  .option(
    "-v, --verbose",
    "詳細ログを出力する (各コレクションのプロパティ数 / API レスポンス概要)",
  )
  .option(
    "--debug",
    "スタックトレースを含む最大詳細ログを出力する (失敗時のみ意味あり)",
  )
  .addHelpText("after", COMMON_PITFALLS)
  .action(run(runGenerate));

program.parse();
