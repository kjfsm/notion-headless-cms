import type {
	BaseContentItem,
	CacheConfig,
	ContentConfig,
	CreateCMSOptions,
	RendererFn,
	SchemaConfig,
} from "@notion-headless-cms/core";
import {
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
	cache?: {
		/** "memory" = インメモリキャッシュ、false = キャッシュなし（デフォルト）。 */
		document?: "memory" | false;
		image?: "memory" | false;
		ttlMs?: number;
	};
}

function isNotionSchema<T extends BaseContentItem>(
	s: SchemaConfig<T> | NotionSchema<T>,
): s is NotionSchema<T> {
	return "zodSchema" in s && "mapping" in s;
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
	if (!token) throw new Error("NOTION_TOKEN environment variable is not set");
	if (!dataSourceId)
		throw new Error("NOTION_DATA_SOURCE_ID environment variable is not set");

	const schema = opts?.schema;
	const notionSchema = schema && isNotionSchema(schema) ? schema : undefined;
	const cmsSchema = schema && !isNotionSchema(schema) ? schema : undefined;

	const source = notionAdapter<T>({
		token,
		dataSourceId,
		schema: notionSchema,
	});

	const docCache =
		opts?.cache?.document === "memory" ? memoryDocumentCache<T>() : false;
	const imgCache = opts?.cache?.image === "memory" ? memoryImageCache() : false;

	const cacheConfig: CacheConfig<T> = {
		document: docCache,
		image: imgCache,
		ttlMs: opts?.cache?.ttlMs,
	};

	const cmsOpts: CreateCMSOptions<T> = {
		source,
		renderer: renderMarkdown as unknown as RendererFn,
		schema: cmsSchema,
		content: opts?.content,
		cache: cacheConfig,
	};

	return createCMS<T>(cmsOpts);
}
