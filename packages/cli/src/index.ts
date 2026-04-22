export interface DataSourceFieldOptions {
	/** slug に使う Notion プロパティ名（自動検出: title 型プロパティ） */
	slug?: string;
	/** status に使う Notion プロパティ名（自動検出: "Status" / "状態" などの select 型） */
	status?: string;
	/** publishedAt に使う Notion プロパティ名（自動検出: "PublishedAt" などの date 型） */
	publishedAt?: string;
	/**
	 * Notion プロパティ名 → TypeScript フィールド名の明示マッピング。
	 * ASCII に変換できないプロパティ名（日本語など）は必須指定。
	 * @example { "タイトル": "title", "カテゴリ": "category" }
	 */
	properties?: Record<string, string>;
}

interface DataSourceWithId {
	name: string;
	/** Notion DB ID（指定した場合は dbName より優先される） */
	id: string;
	/** DB 名（生成ファイルのコメント用。id 指定時は任意） */
	dbName?: string;
	fields?: DataSourceFieldOptions;
}

interface DataSourceWithDbName {
	name: string;
	id?: never;
	/** Notion DB 名（これで DB を検索して ID を解決する） */
	dbName: string;
	fields?: DataSourceFieldOptions;
}

export type DataSourceConfig = DataSourceWithId | DataSourceWithDbName;

export interface NHCConfig {
	dataSources: DataSourceConfig[];
	/** 生成ファイルの出力パス */
	output: string;
	/** Notion API トークン。env() で環境変数から読み込むか、直接文字列を指定する */
	notionToken?: string;
}

/** nhc.config.ts で使う設定ヘルパー。型推論のみで実体は恒等関数。 */
export function defineConfig(config: NHCConfig): NHCConfig {
	return config;
}

/**
 * 環境変数を読み込む設定ヘルパー（Prisma の env() と同様の使い方）。
 * 環境変数が未設定の場合は nhc generate 実行時にエラーを投げる。
 * @example notionToken: env("NOTION_TOKEN")
 */
export function env(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(
			`環境変数 "${name}" が設定されていません。\nnhc generate を実行する前に設定してください。`,
		);
	}
	return value;
}
