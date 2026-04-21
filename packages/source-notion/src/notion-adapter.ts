import type {
	BaseContentItem,
	CMSSchemaProperties,
	DataSourceAdapter,
} from "@notion-headless-cms/core";
import { CMSError, isCMSError } from "@notion-headless-cms/core";
import {
	createClient,
	queryAllPages,
	queryPageBySlug,
} from "./internal/fetcher/index";
import { Transformer } from "./internal/transformer/transformer";
import type { BlockHandler } from "./internal/transformer/types";
import { mapItem } from "./mapper";
import type { NotionSchema } from "./schema";
import type { NotionPage } from "./types";

const DEFAULT_PROPERTIES: Required<CMSSchemaProperties> = {
	slug: "Slug",
	status: "Status",
	date: "CreatedAt",
};

export interface NotionAdapterOptions<
	T extends BaseContentItem = BaseContentItem,
> {
	/** Notion API 認証トークン。 */
	token: string;
	/** Notion データベース（データソース）ID。 */
	dataSourceId: string;
	/** Notionプロパティ名マッピング。 */
	properties?: CMSSchemaProperties;
	/**
	 * Notionページをコンテンツ型 T にマッピングするカスタム関数。
	 * T が BaseContentItem を拡張したカスタム型の場合は必ず指定するか、
	 * 代わりに `schema` を指定すること。指定しない場合、デフォルトマッパーは
	 * BaseContentItem のフィールドのみ返し、T 固有フィールドは undefined となる。
	 */
	mapItem?: (page: NotionPage) => T;
	/** カスタムブロックハンドラーのマップ。 */
	blocks?: Record<string, BlockHandler>;
	/** 宣言的スキーマ定義。指定時は properties / mapItem より優先される。 */
	schema?: NotionSchema<T>;
}

/** Notion を DataSourceAdapter として実装するアダプタ。 */
class NotionAdapter<T extends BaseContentItem = BaseContentItem>
	implements DataSourceAdapter<T>
{
	readonly name = "notion";
	readonly publishedStatuses?: readonly string[];
	readonly accessibleStatuses?: readonly string[];
	private readonly client: ReturnType<typeof createClient>;
	private readonly dataSourceId: string;
	private readonly itemMapper: (page: NotionPage) => T;
	private readonly slugPropName: string;
	private readonly blocksConfig: Record<string, BlockHandler> | undefined;

	constructor(opts: NotionAdapterOptions<T>) {
		this.client = createClient({ NOTION_TOKEN: opts.token });
		this.dataSourceId = opts.dataSourceId;
		this.blocksConfig = opts.blocks;

		if (opts.schema) {
			this.itemMapper = opts.schema.mapItem;
			this.publishedStatuses = opts.schema.publishedStatuses;
			this.accessibleStatuses = opts.schema.accessibleStatuses;
			// schema 経由でも slug プロパティ名を取得（mapping.slug.notion）
			const slugField = (
				opts.schema.mapping as Record<string, { notion: string }>
			).slug;
			this.slugPropName = slugField?.notion ?? DEFAULT_PROPERTIES.slug;
		} else {
			const props: Required<CMSSchemaProperties> = {
				...DEFAULT_PROPERTIES,
				...opts.properties,
			};
			this.slugPropName = props.slug;
			if (opts.mapItem) {
				this.itemMapper = opts.mapItem;
			} else {
				this.itemMapper = (page) => mapItem(page, props) as unknown as T;
			}
		}
	}

	async list(opts?: { publishedStatuses?: readonly string[] }): Promise<T[]> {
		try {
			const pages = await queryAllPages(this.client, this.dataSourceId);
			const items = pages.map(this.itemMapper);
			const filtered =
				opts?.publishedStatuses && opts.publishedStatuses.length > 0
					? items.filter(
							(item) =>
								item.status !== undefined &&
								(opts.publishedStatuses as string[]).includes(item.status),
						)
					: items;
			return filtered.sort((a, b) => {
				const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
				const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
				return bTime - aTime;
			});
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "source/fetch_items_failed",
				message: "Failed to fetch items from Notion data source.",
				cause: err,
				context: {
					operation: "NotionAdapter.list",
					dataSourceId: this.dataSourceId,
				},
			});
		}
	}

	async findBySlug(slug: string): Promise<T | null> {
		try {
			const page = await queryPageBySlug(
				this.client,
				this.dataSourceId,
				slug,
				this.slugPropName,
			);
			if (!page) return null;
			return this.itemMapper(page);
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "source/fetch_item_failed",
				message: "Failed to fetch item by slug from Notion data source.",
				cause: err,
				context: {
					operation: "NotionAdapter.findBySlug",
					dataSourceId: this.dataSourceId,
					slug,
				},
			});
		}
	}

	async loadMarkdown(item: T): Promise<string> {
		const transformer = new Transformer(
			this.blocksConfig ? { blocks: this.blocksConfig } : undefined,
		);
		try {
			return await transformer.transform(this.client, item.id);
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "source/load_markdown_failed",
				message: "Failed to load markdown from Notion.",
				cause: err,
				context: {
					operation: "NotionAdapter.loadMarkdown",
					pageId: item.id,
					slug: item.slug,
				},
			});
		}
	}
}

/** Notion DataSourceAdapter を生成するファクトリ関数。 */
export function notionAdapter<T extends BaseContentItem = BaseContentItem>(
	opts: NotionAdapterOptions<T>,
): DataSourceAdapter<T> {
	return new NotionAdapter<T>(opts);
}
