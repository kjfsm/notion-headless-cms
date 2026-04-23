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

interface NotionAdapterCommonOptions {
	/** Notion API 認証トークン。 */
	token: string;
	/**
	 * Notion データベース（データソース）ID。
	 * `dbName` を指定する場合は省略可能（最初のアクセス時に解決される）。
	 */
	dataSourceId?: string;
	/**
	 * Notion データベース名。`dataSourceId` の代わりに指定すると、
	 * 最初の API 呼び出し時に `client.search` で解決される（結果はキャッシュされる）。
	 */
	dbName?: string;
	/** カスタムブロックハンドラーのマップ。 */
	blocks?: Record<string, BlockHandler>;
}

/** デフォルトマッパー利用時（T = BaseContentItem）の入力。 */
export interface NotionAdapterDefaultOptions
	extends NotionAdapterCommonOptions {
	/** Notionプロパティ名マッピング。 */
	properties?: CMSSchemaProperties;
}

/** カスタム `mapItem` で任意の T に写像するときの入力。 */
export interface NotionAdapterMapItemOptions<T extends BaseContentItem>
	extends NotionAdapterCommonOptions {
	properties?: CMSSchemaProperties;
	mapItem: (page: NotionPage) => T;
}

/** 宣言的スキーマ（`defineSchema()`）で任意の T に写像するときの入力。 */
export interface NotionAdapterSchemaOptions<T extends BaseContentItem>
	extends NotionAdapterCommonOptions {
	schema: NotionSchema<T>;
}

export type NotionAdapterOptions<T extends BaseContentItem = BaseContentItem> =
	| NotionAdapterDefaultOptions
	| NotionAdapterMapItemOptions<T>
	| NotionAdapterSchemaOptions<T>;

/** Notion を DataSourceAdapter として実装するアダプタ。 */
class NotionAdapter<T extends BaseContentItem = BaseContentItem>
	implements DataSourceAdapter<T>
{
	readonly name = "notion";
	readonly publishedStatuses?: readonly string[];
	readonly accessibleStatuses?: readonly string[];
	private readonly client: ReturnType<typeof createClient>;
	private readonly dbName: string | undefined;
	private resolvedDataSourceId: string | undefined;
	private resolvingDataSourceId: Promise<string> | undefined;
	private readonly itemMapper: (page: NotionPage) => T;
	private readonly slugPropName: string;
	private readonly blocksConfig: Record<string, BlockHandler> | undefined;

	constructor(opts: NotionAdapterOptions<T>) {
		if (!opts.dataSourceId && !opts.dbName) {
			throw new CMSError({
				code: "core/config_invalid",
				message:
					"NotionAdapter requires either `dataSourceId` or `dbName` to be set.",
				context: { operation: "NotionAdapter.constructor" },
			});
		}
		this.client = createClient({ NOTION_TOKEN: opts.token });
		this.resolvedDataSourceId = opts.dataSourceId;
		this.dbName = opts.dbName;
		this.blocksConfig = opts.blocks;

		if ("schema" in opts && opts.schema) {
			this.itemMapper = opts.schema.mapItem;
			this.publishedStatuses = opts.schema.publishedStatuses;
			this.accessibleStatuses = opts.schema.accessibleStatuses;
			const slugField = (
				opts.schema.mapping as Record<string, { notion: string }>
			).slug;
			this.slugPropName = slugField?.notion ?? DEFAULT_PROPERTIES.slug;
		} else if ("mapItem" in opts && opts.mapItem) {
			const props: Required<CMSSchemaProperties> = {
				...DEFAULT_PROPERTIES,
				...opts.properties,
			};
			this.slugPropName = props.slug;
			this.itemMapper = opts.mapItem;
		} else {
			const props: Required<CMSSchemaProperties> = {
				...DEFAULT_PROPERTIES,
				...("properties" in opts ? opts.properties : undefined),
			};
			this.slugPropName = props.slug;
			// この分岐はファクトリのオーバーロードにより T = BaseContentItem が保証される。
			this.itemMapper = ((page: NotionPage) => mapItem(page, props)) as (
				page: NotionPage,
			) => T;
		}
	}

	/** dataSourceId を返す。未設定なら dbName で検索して解決し、結果をキャッシュする。 */
	private async getDataSourceId(): Promise<string> {
		if (this.resolvedDataSourceId) return this.resolvedDataSourceId;
		if (this.resolvingDataSourceId) return this.resolvingDataSourceId;
		const dbName = this.dbName;
		if (!dbName) {
			throw new CMSError({
				code: "core/config_invalid",
				message: "dataSourceId is not set and dbName was not provided.",
				context: { operation: "NotionAdapter.getDataSourceId" },
			});
		}
		this.resolvingDataSourceId = (async () => {
			const response = await this.client.search({
				query: dbName,
				filter: { property: "object", value: "data_source" },
			});
			for (const result of response.results) {
				if (result.object !== "data_source") continue;
				const ds = result as { id: string; title?: { plain_text: string }[] };
				const title = ds.title?.map((t) => t.plain_text).join("") ?? "";
				if (title === dbName) {
					this.resolvedDataSourceId = ds.id;
					return ds.id;
				}
			}
			const first = response.results.find((r) => r.object === "data_source") as
				| { id: string }
				| undefined;
			if (!first) {
				throw new CMSError({
					code: "source/fetch_items_failed",
					message: `Notion データベース "${dbName}" が見つかりませんでした。インテグレーションが DB にアクセスできるか確認してください。`,
					context: { operation: "NotionAdapter.getDataSourceId", dbName },
				});
			}
			this.resolvedDataSourceId = first.id;
			return first.id;
		})();
		try {
			return await this.resolvingDataSourceId;
		} finally {
			this.resolvingDataSourceId = undefined;
		}
	}

	async list(opts?: { publishedStatuses?: readonly string[] }): Promise<T[]> {
		try {
			const dataSourceId = await this.getDataSourceId();
			const pages = await queryAllPages(this.client, dataSourceId);
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
					dataSourceId: this.resolvedDataSourceId,
					dbName: this.dbName,
				},
			});
		}
	}

	async findBySlug(slug: string): Promise<T | null> {
		try {
			const dataSourceId = await this.getDataSourceId();
			const page = await queryPageBySlug(
				this.client,
				dataSourceId,
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
					dataSourceId: this.resolvedDataSourceId,
					dbName: this.dbName,
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

/** デフォルトマッパーで `BaseContentItem` を返す Notion アダプタを生成する。 */
export function notionAdapter(
	opts: NotionAdapterDefaultOptions,
): DataSourceAdapter<BaseContentItem>;
/** カスタム `mapItem` で任意の `T` に写像するアダプタを生成する。 */
export function notionAdapter<T extends BaseContentItem>(
	opts: NotionAdapterMapItemOptions<T>,
): DataSourceAdapter<T>;
/** 宣言的 `schema` で任意の `T` に写像するアダプタを生成する。 */
export function notionAdapter<T extends BaseContentItem>(
	opts: NotionAdapterSchemaOptions<T>,
): DataSourceAdapter<T>;
export function notionAdapter<T extends BaseContentItem = BaseContentItem>(
	opts: NotionAdapterOptions<T>,
): DataSourceAdapter<T> {
	return new NotionAdapter<T>(opts);
}
