export interface DataSourceFieldOptions {
	/** slug に使う Notion プロパティ名（デフォルト: title 型プロパティ） */
	slug?: string;
	/** status に使う Notion プロパティ名（デフォルト: "Status" / "状態" などの select 型） */
	status?: string;
	/** publishedAt に使う Notion プロパティ名（デフォルト: "PublishedAt" などの date 型） */
	publishedAt?: string;
	/** 公開ステータス値（生成後に手動設定が必要） */
	published?: string[];
	/** アクセス可能ステータス値（未指定時は published と同じ値） */
	accessible?: string[];
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
	/** 生成ファイルの出力パス（デフォルト: ./nhc-schema.ts） */
	output?: string;
}

/** nhc.config.ts で使う設定ヘルパー。型推論のみで実体は恒等関数。 */
export function defineConfig(config: NHCConfig): NHCConfig {
	return config;
}
