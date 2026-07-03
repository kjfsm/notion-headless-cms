import path from "node:path";
import { CMSError } from "@notion-headless-cms/core";
import { config as dotenvConfig } from "dotenv";
import { fileExists } from "../fs-utils.js";

export interface ReporterOptions {
  silent?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

export interface Reporter {
  info(msg: string): void;
  step(msg: string): void;
  debug(msg: string): void;
}

/** `pull`/`check`/`generate` で共通のログ出力ヘルパー。 */
export function makeReporter(opts: ReporterOptions): Reporter {
  const silent = opts.silent ?? false;
  const verbose = opts.verbose ?? opts.debug ?? false;
  return {
    info(msg) {
      if (!silent) console.log(msg);
    },
    step(msg) {
      if (!silent) console.log(msg);
    },
    debug(msg) {
      if (!silent && verbose) console.log(`  [verbose] ${msg}`);
    },
  };
}

/**
 * --env-file 指定時はそのファイルを、未指定時は .dev.vars があれば自動ロードする。
 * process.env 既存値は上書きしない (dotenv のデフォルト挙動)。
 */
export async function loadEnvFile(
  envFile: string | undefined,
  reporter: Reporter,
): Promise<void> {
  if (envFile) {
    const envFilePath = path.resolve(process.cwd(), envFile);
    if (!(await fileExists(envFilePath))) {
      throw new CMSError({
        code: "cli/env_file_not_found",
        message: `環境変数ファイルが見つかりません: ${envFilePath}`,
        context: { operation: "loadEnvFile", envFilePath },
      });
    }
    dotenvConfig({ path: envFilePath });
    reporter.info(`環境変数ファイルを読み込み中: ${envFilePath}`);
    return;
  }

  const devVarsPath = path.resolve(process.cwd(), ".dev.vars");
  if (await fileExists(devVarsPath)) {
    dotenvConfig({ path: devVarsPath });
    reporter.info(`環境変数ファイルを自動検出: ${devVarsPath}`);
  } else {
    reporter.debug(
      ".dev.vars は見つかりませんでした (process.env のみ使用します)",
    );
  }
}

/** `--token` フラグ → `nhc.config.ts` の `notionToken` → `NOTION_TOKEN` 環境変数の順で解決する。 */
export function resolveToken(
  explicitToken: string | undefined,
  configToken: string | undefined,
  operation: string,
): string {
  const token = explicitToken || configToken || process.env.NOTION_TOKEN;
  if (token) return token;
  throw new CMSError({
    code: "cli/config_invalid",
    message:
      "Notion トークンが設定されていません。以下のいずれかで指定してください:\n" +
      '  - nhc.config.ts に notionToken: env("NOTION_TOKEN") を追加\n' +
      "  - 環境変数 NOTION_TOKEN を設定\n" +
      "  - --env-file .dev.vars で環境変数ファイルを指定\n" +
      "  - --token フラグを使用",
    context: { operation },
  });
}
