#!/usr/bin/env node
import { Command } from "commander";
import { runGenerate } from "./commands/generate.js";
import { runInit } from "./commands/init.js";

const program = new Command()
	.name("nhc")
	.description("notion-headless-cms CLI")
	.version("0.1.0");

program
	.command("init")
	.description("nhc.config.ts のテンプレートを生成します")
	.option("-o, --output <path>", "出力先ファイルパス", "nhc.config.ts")
	.option("-f, --force", "既存ファイルを上書きする")
	.action(async (opts: { output?: string; force?: boolean }) => {
		try {
			await runInit(opts);
		} catch (err) {
			console.error(
				"エラー:",
				err instanceof Error ? err.message : String(err),
			);
			process.exit(1);
		}
	});

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
	.action(async (opts: { config?: string; token?: string }) => {
		try {
			await runGenerate(opts);
		} catch (err) {
			console.error(
				"エラー:",
				err instanceof Error ? err.message : String(err),
			);
			process.exit(1);
		}
	});

program.parse();
