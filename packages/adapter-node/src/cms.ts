import type {
	BaseContentItem,
	CacheConfig,
	ContentConfig,
	CreateCMSOptions,
	SchemaConfig,
} from "@notion-headless-cms/core";
import {
	CMSError,
	createCMS,
	memoryDocumentCache,
	memoryImageCache,
} from "@notion-headless-cms/core";
import { renderMarkdown } from "@notion-headless-cms/renderer";
import type { NotionSchema } from "@notion-headless-cms/source-notion";
import { notionAdapter } from "@notion-headless-cms/source-notion";

export interface NodeCMSOptions<T extends BaseContentItem = BaseContentItem> {
	/** defineSchema() の戻り値または SchemaConfig を受け取る。 */
	schema?: SchemaConfig<T> | NotionSchema<T>;
	content?: ContentConfig;
	/**
	 * キャッシュ設定。`"disabled"` で完全に無効化。
	 * document/image には `"memory"` でインメモリキャッシュを指定できる。
	 */
	cache?:
		| "disabled"
		| {
				document?: "memory";
				image?: "memory";
				ttlMs?: number;
		  };
}

function isNotionSchema<T extends BaseContentItem>(
	s: SchemaConfig<T> | NotionSchema<T>,
): s is NotionSchema<T> {
	return "mapping" in s && "mapItem" in s;
}

function resolveCacheConfig<T extends BaseContentItem>(
	cache: NodeCMSOptions["cache"],
): CacheConfig<T> {
	if (cache === "disabled" || cache === undefined) return "disabled";
	return {
		document:
			cache.document === "memory" ? memoryDocumentCache<T>() : undefined,
		image: cache.image === "memory" ? memoryImageCache() : undefined,
		ttlMs: cache.ttlMs,
	};
}

/**
 * Node.js 環境向け CMS ファクトリ。
 * process.env.NOTION_TOKEN / NOTION_DATA_SOURCE_ID を自動で読み取る。
 * createCloudflareCMS() と対称的なインターフェース。
 */
export function createNodeCMS<T extends BaseContentItem = BaseContentItem>(
	opts?: NodeCMSOptions<T>,
): ReturnType<typeof createCMS<T>> {
	const token = process.env.NOTION_TOKEN;
	const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;
	if (!token) {
		throw new CMSError({
			code: "core/config_invalid",
			message: "NOTION_TOKEN environment variable is not set",
			context: { operation: "createNodeCMS", envVar: "NOTION_TOKEN" },
		});
	}
	if (!dataSourceId) {
		throw new CMSError({
			code: "core/config_invalid",
			message: "NOTION_DATA_SOURCE_ID environment variable is not set",
			context: {
				operation: "createNodeCMS",
				envVar: "NOTION_DATA_SOURCE_ID",
			},
		});
	}

	const schema = opts?.schema;
	const notionSchema = schema && isNotionSchema(schema) ? schema : undefined;
	const cmsSchema = schema && !isNotionSchema(schema) ? schema : undefined;

	const source = notionAdapter<T>({
		token,
		dataSourceId,
		schema: notionSchema,
	});

	const cmsOpts: CreateCMSOptions<T> = {
		source,
		renderer: renderMarkdown,
		schema: cmsSchema,
		content: opts?.content,
		cache: resolveCacheConfig<T>(opts?.cache),
	};

	return createCMS<T>(cmsOpts);
}

// ── Multi-Source ──────────────────────────────────────────────────────────────

/** nhcSchema の各エントリの型。generateSchema() が生成するオブジェクトと対応する。 */
export interface MultiSourceEntry<T extends BaseContentItem = BaseContentItem> {
	id: string;
	dbName: string;
	schema?: NotionSchema<T>;
}

export type MultiSourceSchema = Record<
	string,
	MultiSourceEntry<BaseContentItem>
>;

type InferSourceItem<E> =
	E extends MultiSourceEntry<infer T> ? T : BaseContentItem;

export type MultiCMSResult<S extends MultiSourceSchema> = {
	[K in keyof S]: ReturnType<typeof createCMS<InferSourceItem<S[K]>>>;
};

export interface CreateNodeMultiCMSOptions<S extends MultiSourceSchema> {
	/** nhcSchema（nhc generate で生成されたオブジェクト） */
	schema: S;
	/** Notion API トークン（省略時は process.env.NOTION_TOKEN を使用） */
	token?: string;
	cache?: NodeCMSOptions["cache"];
	content?: ContentConfig;
}

/**
 * マルチソース向け Node.js CMS ファクトリ。
 * nhc generate で生成した nhcSchema を渡すと、各ソースに対応する CMS インスタンスを返す。
 *
 * @example
 * const client = createNodeMultiCMS({ schema: nhcSchema })
 * const posts = await client.posts.list()
 */
export function createNodeMultiCMS<S extends MultiSourceSchema>(
	opts: CreateNodeMultiCMSOptions<S>,
): MultiCMSResult<S> {
	const token = opts.token ?? process.env.NOTION_TOKEN;
	if (!token) {
		throw new CMSError({
			code: "core/config_invalid",
			message: "NOTION_TOKEN environment variable is not set",
			context: { operation: "createNodeMultiCMS", envVar: "NOTION_TOKEN" },
		});
	}

	const cacheConfig = resolveCacheConfig(opts.cache);
	const result = {} as MultiCMSResult<S>;

	for (const key of Object.keys(opts.schema) as (keyof S & string)[]) {
		const entry = opts.schema[key] as MultiSourceEntry<BaseContentItem>;
		const source = notionAdapter({
			token,
			dataSourceId: entry.id,
			schema: entry.schema,
		});
		(result as Record<string, unknown>)[key] = createCMS({
			source,
			renderer: renderMarkdown,
			cache: cacheConfig,
			content: opts.content,
		});
	}

	return result;
}
