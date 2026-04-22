import fs from "node:fs/promises";
import path from "node:path";
import { config as dotenvConfig } from "dotenv";
import type { ResolvedSource } from "../codegen.js";
import { generateSchemaFile } from "../codegen.js";
import { loadConfig } from "../config-loader.js";
import { createNotionCLIClient } from "../notion-client.js";

export interface GenerateOptions {
	config?: string;
	token?: string;
	envFile?: string;
}

export async function runGenerate(opts: GenerateOptions): Promise<void> {
	if (opts.envFile) {
		const envFilePath = path.resolve(process.cwd(), opts.envFile);
		try {
			await fs.access(envFilePath);
		} catch {
			throw new Error(`環境変数ファイルが見つかりません: ${envFilePath}`);
		}
		dotenvConfig({ path: envFilePath });
		console.log(`環境変数ファイルを読み込み中: ${envFilePath}`);
	}

	const configPath = path.resolve(
		process.cwd(),
		opts.config ?? "nhc.config.ts",
	);

	console.log(`設定ファイルを読み込み中: ${configPath}`);
	const config = await loadConfig(configPath);

	const token = opts.token ?? config.notionToken ?? process.env.NOTION_TOKEN;
	if (!token) {
		throw new Error(
			"Notion トークンが設定されていません。以下のいずれかで指定してください:\n" +
				'  - nhc.config.ts に notionToken: env("NOTION_TOKEN") を追加\n' +
				"  - 環境変数 NOTION_TOKEN を設定\n" +
				"  - --env-file .dev.vars で環境変数ファイルを指定\n" +
				"  - --token フラグを使用",
		);
	}

	const notionClient = createNotionCLIClient(token);

	console.log(`${config.dataSources.length} 件のデータソースを解決中...`);
	const resolvedSources: ResolvedSource[] = [];

	for (const ds of config.dataSources) {
		let resolvedId: string;

		if (ds.id) {
			resolvedId = ds.id;
		} else {
			// ds.id が falsy のとき、DataSourceWithDbName として dbName は必ず string
			const dbName = ds.dbName as string;
			const found = await notionClient.resolveId(dbName);
			if (!found) {
				throw new Error(
					`データベース "${dbName}" が見つかりませんでした。\n` +
						"・Notion トークンにそのデータベースへのアクセス権限があるか確認してください。\n" +
						"・DB 名が正確に一致しているか確認してください。",
				);
			}
			resolvedId = found;
		}

		const ds_ = await notionClient.retrieveDataSource(resolvedId);
		const dbName =
			ds.dbName ?? (ds_.title.map((t) => t.plain_text).join("") || resolvedId);

		console.log(`  ✓ ${ds.name}: ${resolvedId} (${dbName})`);

		resolvedSources.push({
			config: ds,
			id: resolvedId,
			dbName,
			properties: ds_.properties,
		});
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
	console.log(`   .gitignore に追加することを検討してください:`);
	console.log(`   echo "${relPath}" >> .gitignore`);
}
