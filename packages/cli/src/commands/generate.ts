import fs from "node:fs/promises";
import path from "node:path";
import { config as dotenvConfig } from "dotenv";
import type { ResolvedSource } from "../codegen.js";
import { generateSchemaFile } from "../codegen.js";
import { loadConfig } from "../config-loader.js";
import { fileExists } from "../fs-utils.js";
import type { DataSourceConfig, NHCConfig } from "../index.js";
import {
	createNotionCLIClient,
	type NotionCLIClient,
} from "../notion-client.js";

export interface GenerateOptions {
	config?: string;
	token?: string;
	envFile?: string;
}

/**
 * --env-file 指定時はそのファイルを、未指定時は .dev.vars があれば自動ロードする。
 * process.env 既存値は上書きしない（dotenv のデフォルト挙動）。
 */
async function loadEnvFile(envFile: string | undefined): Promise<void> {
	if (envFile) {
		const envFilePath = path.resolve(process.cwd(), envFile);
		if (!(await fileExists(envFilePath))) {
			throw new Error(`環境変数ファイルが見つかりません: ${envFilePath}`);
		}
		dotenvConfig({ path: envFilePath });
		console.log(`環境変数ファイルを読み込み中: ${envFilePath}`);
		return;
	}

	// .dev.vars 自動検出（Cloudflare Workers のローカル開発環境向け）
	const devVarsPath = path.resolve(process.cwd(), ".dev.vars");
	if (await fileExists(devVarsPath)) {
		dotenvConfig({ path: devVarsPath });
		console.log(`環境変数ファイルを自動検出: ${devVarsPath}`);
	}
}

function resolveToken(opts: GenerateOptions, config: NHCConfig): string {
	const token = opts.token || config.notionToken || process.env.NOTION_TOKEN;
	if (token) return token;
	throw new Error(
		"Notion トークンが設定されていません。以下のいずれかで指定してください:\n" +
			'  - nhc.config.ts に notionToken: env("NOTION_TOKEN") を追加\n' +
			"  - 環境変数 NOTION_TOKEN を設定\n" +
			"  - --env-file .dev.vars で環境変数ファイルを指定\n" +
			"  - --token フラグを使用",
	);
}

async function resolveDataSource(
	ds: DataSourceConfig,
	client: NotionCLIClient,
): Promise<ResolvedSource> {
	let resolvedId = ds.id;
	if (!resolvedId) {
		// ds.id が未指定のとき、DataSourceWithDbName として dbName は必ず string
		const dbName = ds.dbName as string;
		const found = await client.resolveId(dbName);
		if (!found) {
			throw new Error(
				`データベース "${dbName}" が見つかりませんでした。\n` +
					"・Notion トークンにそのデータベースへのアクセス権限があるか確認してください。\n" +
					"・DB 名が正確に一致しているか確認してください。",
			);
		}
		resolvedId = found;
	}

	const retrieved = await client.retrieveDataSource(resolvedId);
	const retrievedTitle = retrieved.title.map((t) => t.plain_text).join("");
	const dbName = ds.dbName ?? (retrievedTitle || resolvedId);

	return {
		config: ds,
		id: resolvedId,
		dbName,
		properties: retrieved.properties,
	};
}

export async function runGenerate(opts: GenerateOptions): Promise<void> {
	await loadEnvFile(opts.envFile);

	const configPath = path.resolve(
		process.cwd(),
		opts.config ?? "nhc.config.ts",
	);
	console.log(`設定ファイルを読み込み中: ${configPath}`);
	const config = await loadConfig(configPath);

	const token = resolveToken(opts, config);
	const notionClient = createNotionCLIClient(token);

	console.log(`${config.dataSources.length} 件のデータソースを解決中...`);
	const resolvedSources: ResolvedSource[] = [];
	for (const ds of config.dataSources) {
		const resolved = await resolveDataSource(ds, notionClient);
		console.log(`  ✓ ${ds.name}: ${resolved.id} (${resolved.dbName})`);
		resolvedSources.push(resolved);
	}

	const code = generateSchemaFile(resolvedSources);
	const outputPath = path.resolve(process.cwd(), config.output);
	await fs.mkdir(path.dirname(outputPath), { recursive: true });
	await fs.writeFile(outputPath, code, "utf-8");

	console.log(`\n生成完了: ${outputPath}`);
	console.log(
		"次のステップ: createNodeMultiCMS / createCloudflareCMSMulti の sources オプションで published / accessible を設定してください。",
	);

	const relPath = path.relative(process.cwd(), outputPath);
	console.log(`\n⚠  生成ファイルには Notion DB の ID が含まれています。`);
	console.log(`   .gitignore への追加を検討してください: ${relPath}`);
}
