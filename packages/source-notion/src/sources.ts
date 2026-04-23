import type {
	BaseContentItem,
	CMS,
	SchemaConfig,
} from "@notion-headless-cms/core";
import type { NotionSchema } from "./schema";

/**
 * `nhc generate` が生成する `nhcSchema` の各エントリ。
 * `id` は Notion データソース ID、`dbName` は Notion DB 名、
 * `schema` は `defineSchema()` の戻り値。
 */
export interface SourceEntry<T extends BaseContentItem = BaseContentItem> {
	id: string;
	dbName: string;
	schema?: NotionSchema<T>;
}

/**
 * `nhc generate` が生成する `nhcSchema` オブジェクトの型。
 * ソース名をキー、`SourceEntry` を値とする。
 */
// biome-ignore lint/suspicious/noExplicitAny: 異なる T を持つエントリを同一マップに混在させるため
export type NHCSchema = Record<string, SourceEntry<any>>;

/** ソースごとの公開ステータス設定。生成ファイルを編集せず差し込める。 */
export interface SourceStatusConfig {
	/** 公開済みとみなすステータス値。未指定時は全件返す。 */
	published?: string[];
	/** アクセス可能とみなすステータス値。未指定時は `published` と同じ。 */
	accessible?: string[];
}

/** `SourceEntry` から含まれるコンテンツ型 T を抽出するユーティリティ型。 */
export type InferSourceItem<E> =
	E extends SourceEntry<infer T> ? T : BaseContentItem;

/**
 * `nhcSchema` の各キーを `CMS<T>` に写像するマップ型。
 * `client.posts.list()` のように型安全にアクセスできる。
 */
export type CMSMap<S extends NHCSchema> = {
	[K in keyof S]: CMS<InferSourceItem<S[K]>>;
};

/** `SchemaConfig` と `NotionSchema` を判別する型ガード。 */
export function isNotionSchema<T extends BaseContentItem>(
	s: SchemaConfig<T> | NotionSchema<T>,
): s is NotionSchema<T> {
	return "mapping" in s && "mapItem" in s;
}
