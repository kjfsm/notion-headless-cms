import type {
	BaseContentItem,
	CMSSchemaProperties,
	DataSourceAdapter,
} from "@notion-headless-cms/core";
import { CMSError, isCMSError, mapItem } from "@notion-headless-cms/core";
import {
	createClient,
	queryAllPages,
	queryPageBySlug,
} from "@notion-headless-cms/fetcher";
import type { BlockHandler } from "@notion-headless-cms/transformer";
import { Transformer } from "@notion-headless-cms/transformer";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

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
	/** Notionページをコンテンツ型 T にマッピングするカスタム関数。 */
	mapItem?: (page: PageObjectResponse) => T;
	/** カスタムブロックハンドラーのマップ。 */
	blocks?: Record<string, BlockHandler>;
}

/** Notion を DataSourceAdapter として実装するアダプタ。 */
class NotionAdapter<T extends BaseContentItem = BaseContentItem>
	implements DataSourceAdapter<T>
{
	readonly name = "notion";
	private readonly client: ReturnType<typeof createClient>;
	private readonly dataSourceId: string;
	private readonly itemMapper: (page: PageObjectResponse) => T;
	private readonly slugPropName: string;
	private readonly blocksConfig: Record<string, BlockHandler> | undefined;

	constructor(opts: NotionAdapterOptions<T>) {
		this.client = createClient({ NOTION_TOKEN: opts.token });
		this.dataSourceId = opts.dataSourceId;
		this.blocksConfig = opts.blocks;

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

	async list(opts?: { publishedStatuses?: readonly string[] }): Promise<T[]> {
		try {
			const pages = await queryAllPages(this.client, this.dataSourceId);
			const items = pages.map(this.itemMapper);
			const filtered =
				opts?.publishedStatuses && opts.publishedStatuses.length > 0
					? items.filter((item) =>
							(opts.publishedStatuses as string[]).includes(item.status),
						)
					: items;
			return filtered.sort(
				(a, b) =>
					new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
			);
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "NOTION_FETCH_ITEMS_FAILED",
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
				code: "NOTION_FETCH_ITEM_BY_SLUG_FAILED",
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
				code: "NOTION_MARKDOWN_FETCH_FAILED",
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
