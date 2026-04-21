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

	const cacheConfig: CacheConfig<T> =
		opts?.cache === "disabled" || opts?.cache === undefined
			? "disabled"
			: {
					document:
						opts.cache.document === "memory"
							? memoryDocumentCache<T>()
							: undefined,
					image: opts.cache.image === "memory" ? memoryImageCache() : undefined,
					ttlMs: opts.cache.ttlMs,
				};

	const cmsOpts: CreateCMSOptions<T> = {
		source,
		renderer: renderMarkdown,
		schema: cmsSchema,
		content: opts?.content,
		cache: cacheConfig,
	};

	return createCMS<T>(cmsOpts);
}
