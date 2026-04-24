interface DataSourceWithId {
	name: string;
	/** Notion DB ID（指定した場合は dbName より優先される） */
	id: string;
	/** DB 名（生成ファイルのコメント用。id 指定時は任意） */
	dbName?: string;
	/**
	 * Notion プロパティ名 → TypeScript フィールド名の明示マッピング。
	 * ASCII に変換できないプロパティ名（日本語など）はここで指定する。
	 * @example { "タイトル": "customTitle", "カテゴリ": "category" }
	 */
	columnMappings?: Record<string, string>;
}

interface DataSourceWithDbName {
	name: string;
	id?: never;
	/** Notion DB 名（これで DB を検索して ID を解決する） */
	dbName: string;
	/**
	 * Notion プロパティ名 → TypeScript フィールド名の明示マッピング。
	 * ASCII に変換できないプロパティ名（日本語など）はここで指定する。
	 * @example { "タイトル": "customTitle", "カテゴリ": "category" }
	 */
	columnMappings?: Record<string, string>;
}

export type DataSourceConfig = DataSourceWithId | DataSourceWithDbName;

export interface CMSConfig {
	dataSources: DataSourceConfig[];
	/** 生成ファイルの出力パス */
	output: string;
	/** Notion API トークン。env() で環境変数から読み込むか、直接文字列を指定する */
	notionToken?: string;
}

/** nhc.config.ts で使う設定ヘルパー。型推論のみで実体は恒等関数。 */
export function defineConfig(config: CMSConfig): CMSConfig {
	return config;
}

/**
 * 環境変数を読み込む設定ヘルパー（Prisma の env() と同様の使い方）。
 * 環境変数が未設定の場合は空文字を返す。トークン未設定エラーは nhc generate 実行時に表示される。
 * @example notionToken: env("NOTION_TOKEN")
 */
export function env(name: string): string {
	return process.env[name] ?? "";
}
