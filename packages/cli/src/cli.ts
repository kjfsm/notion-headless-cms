#!/usr/bin/env node
import { isCMSError } from "@notion-headless-cms/cms";
import { Command } from "commander";
import { runCheck } from "./commands/check.js";
import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runPull } from "./commands/pull.js";
import { runSync } from "./commands/sync.js";

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
      // verbose / debug 時は CMSError のコード・context 付きの詳細を、
      // それ以外は短いメッセージのみを出力する。
      if (isCMSError(err) && (opts.verbose || opts.debug)) {
        console.error(
          "エラー:",
          `[${err.code}] ${err.message} (operation: ${err.context.operation})`,
        );
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
  .description(
    "nhc.config.ts・wrangler.toml・src/schema.ts・Hono マウントコード一式を生成します",
  )
  .option(
    "-o, --output <path>",
    "nhc.config.ts の出力先ファイルパス",
    "nhc.config.ts",
  )
  .option("-f, --force", "既存ファイルを上書きする")
  .option("-s, --silent", "ログ出力を抑制する")
  .option("-v, --verbose", "詳細ログを出力する")
  .option("--debug", "スタックトレースを含む最大詳細ログを出力する")
  .action(run(runInit));

program
  .command("pull")
  .description(
    "nhc.config.ts の collections を introspect し、defineCollection の雛形コードを生成します",
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
  .option(
    "--scaffold-dir <path>",
    "雛形の出力先ディレクトリ（既定: scaffoldDir または src/collections）",
  )
  .option("-s, --silent", "ログ出力を抑制する")
  .option("-v, --verbose", "詳細ログを出力する")
  .option(
    "--debug",
    "スタックトレースを含む最大詳細ログを出力する (失敗時のみ意味あり)",
  )
  .addHelpText("after", COMMON_PITFALLS)
  .action(run(runPull));

program
  .command("check")
  .description(
    "nhc.config.ts の schemaModule と実 Notion DB の差分(drift)を検証します。CI 向け",
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
  .option("--json", "機械可読な JSON で結果を出力する")
  .option("-s, --silent", "ログ出力を抑制する")
  .option("-v, --verbose", "詳細ログを出力する")
  .option(
    "--debug",
    "スタックトレースを含む最大詳細ログを出力する (失敗時のみ意味あり)",
  )
  .addHelpText("after", COMMON_PITFALLS)
  .action(run(runCheck));

program
  .command("doctor")
  .description(
    "binding 宣言(wrangler.toml)・webhook secret・token 権限・同期状態・slug 重複を診断します(#446)",
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
  .option(
    "--wrangler-config <path>",
    "wrangler 設定ファイルのパス",
    "wrangler.toml",
  )
  .option(
    "--stats-url <url>",
    "デプロイ済み Worker が公開する同期統計エンドポイントの URL（任意）",
  )
  .option("--json", "機械可読な JSON で結果を出力する")
  .option("-s, --silent", "ログ出力を抑制する")
  .option("-v, --verbose", "詳細ログを出力する")
  .option(
    "--debug",
    "スタックトレースを含む最大詳細ログを出力する (失敗時のみ意味あり)",
  )
  .addHelpText("after", COMMON_PITFALLS)
  .action(run(runDoctor));

program
  .command("sync")
  .description(
    "schemaModule の全コレクションをローカルファイルストアへ同期します(初回 kick 経路、#446)",
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
  .option(
    "--cache-dir <path>",
    "マテリアライズ先のローカルディレクトリ",
    ".nhc-cache",
  )
  .option("--json", "機械可読な JSON で結果を出力する")
  .option("-s, --silent", "ログ出力を抑制する")
  .option("-v, --verbose", "詳細ログを出力する")
  .option(
    "--debug",
    "スタックトレースを含む最大詳細ログを出力する (失敗時のみ意味あり)",
  )
  .addHelpText("after", COMMON_PITFALLS)
  .action(run(runSync));

program.parse();
