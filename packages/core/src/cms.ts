import {
	createClient,
	queryAllPages,
	queryPageBySlug,
} from "@notion-headless-cms/fetcher";
import { renderMarkdown } from "@notion-headless-cms/renderer";
import { Transformer } from "@notion-headless-cms/transformer";
import type { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { CacheStore, isStale } from "./cache";
import { CMSError, isCMSError } from "./errors";
import { buildCacheImageFn } from "./image";
import { mapItem } from "./mapper";
import type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
	CMSConfig,
	CMSEnv,
	CMSSchemaProperties,
	StorageBinary,
} from "./types";

const DEFAULT_PROPERTIES: Required<CMSSchemaProperties> = {
	slug: "Slug",
	status: "Status",
	date: "CreatedAt",
};

const DEFAULT_IMAGE_PROXY_BASE = "/api/images";
const DEFAULT_LIST_KEY = "content.json";
const DEFAULT_ITEM_PREFIX = "content/";
const DEFAULT_IMAGE_PREFIX = "images/";

function buildListVersion<T extends BaseContentItem>(items: T[]): string {
	return items.map((item) => `${item.id}:${item.updatedAt}`).join("|");
}

function validateEnv(env: CMSEnv): { dataSourceId: string } {
	if (!env.NOTION_TOKEN || !env.NOTION_DATA_SOURCE_ID) {
		throw new CMSError({
			code: "CONFIG_INVALID",
			message:
				"NOTION_TOKEN and NOTION_DATA_SOURCE_ID are required to use Notion CMS APIs.",
			context: {
				operation: "validateEnv",
				hasNotionToken: !!env.NOTION_TOKEN,
				hasNotionDataSourceId: !!env.NOTION_DATA_SOURCE_ID,
			},
		});
	}
	return { dataSourceId: env.NOTION_DATA_SOURCE_ID };
}

/**
 * Notion をバックエンドとして使う汎用ヘッドレス CMSクラス。
 *
 * @example
 * const cms = createCMS({
 *   env: { NOTION_TOKEN: '...', NOTION_DATA_SOURCE_ID: '...' },
 *   schema: { publishedStatuses: ['Published'] }
 * });
 * const items = await cms.getItems();
 */
export class CMS<T extends BaseContentItem = BaseContentItem> {
	private readonly itemMapper: (page: PageObjectResponse) => T;
	private readonly slugPropName: string;
	private readonly publishedStatuses: string[];
	private readonly accessibleStatuses: string[];
	private readonly imageProxyBase: string;
	private readonly transformerConfig: CMSConfig<T>["transformer"];
	private readonly rendererConfig: CMSConfig<T>["renderer"];
	private readonly store: CacheStore<T>;
	private readonly hasStorage: boolean;
	private readonly ttlMs: number | undefined;
	private readonly client: Client | undefined;
	private readonly dataSourceId: string | undefined;

	constructor(config?: CMSConfig<T>) {
		const props: Required<CMSSchemaProperties> = {
			...DEFAULT_PROPERTIES,
			...config?.schema?.properties,
		};
		this.slugPropName = props.slug;

		if (config?.schema?.mapItem) {
			this.itemMapper = config.schema.mapItem;
		} else {
			this.itemMapper = (page) => mapItem(page, props) as unknown as T;
		}

		this.publishedStatuses = config?.schema?.publishedStatuses ?? [];
		this.accessibleStatuses = config?.schema?.accessibleStatuses ?? [];
		this.imageProxyBase =
			config?.renderer?.imageProxyBase ?? DEFAULT_IMAGE_PROXY_BASE;
		this.transformerConfig = config?.transformer;
		this.rendererConfig = config?.renderer;
		this.hasStorage = !!config?.storage;
		this.ttlMs = config?.cache?.ttlMs;
		this.store = new CacheStore<T>(
			config?.storage,
			config?.cache?.listKey ?? DEFAULT_LIST_KEY,
			config?.cache?.itemPrefix ?? DEFAULT_ITEM_PREFIX,
			config?.cache?.imagePrefix ?? DEFAULT_IMAGE_PREFIX,
		);

		if (config?.env) {
			const { dataSourceId } = validateEnv(config.env);
			this.client = createClient(config.env);
			this.dataSourceId = dataSourceId;
		}
	}

	// ── プライベートヘルパー（認証） ──────────────────────────────────────

	private requireClient(): { client: Client; dataSourceId: string } {
		if (!this.client || !this.dataSourceId) {
			throw new CMSError({
				code: "CONFIG_INVALID",
				message:
					"NOTION_TOKEN と NOTION_DATA_SOURCE_ID は CMS の設定に必要です。",
				context: { operation: "requireClient" },
			});
		}
		return { client: this.client, dataSourceId: this.dataSourceId };
	}

	// ── コンテンツ取得 ────────────────────────────────────────────────────

	/** 公開済みコンテンツ一覧を Notion から直接取得する。 */
	async getItems(): Promise<T[]> {
		const { client, dataSourceId } = this.requireClient();
		try {
			const pages = await queryAllPages(client, dataSourceId);
			const items = pages.map(this.itemMapper);
			const filtered =
				this.publishedStatuses.length > 0
					? items.filter((item) => this.publishedStatuses.includes(item.status))
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
				context: { operation: "getItems", dataSourceId },
			});
		}
	}

	/** スラッグでコンテンツを Notion から直接取得する。 */
	async getItemBySlug(slug: string): Promise<T | null> {
		const { client, dataSourceId } = this.requireClient();
		try {
			const page = await queryPageBySlug(
				client,
				dataSourceId,
				slug,
				this.slugPropName,
			);
			if (!page) return null;
			const item = this.itemMapper(page);
			if (
				this.accessibleStatuses.length > 0 &&
				!this.accessibleStatuses.includes(item.status)
			) {
				return null;
			}
			return item;
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "NOTION_FETCH_ITEM_BY_SLUG_FAILED",
				message: "Failed to fetch item by slug from Notion data source.",
				cause: err,
				context: { operation: "getItemBySlug", dataSourceId, slug },
			});
		}
	}

	/** アイテムが publishedStatuses に含まれるステータスかどうかを返す。 */
	isPublished(item: T): boolean {
		if (this.publishedStatuses.length === 0) return true;
		return this.publishedStatuses.includes(item.status);
	}

	/** コンテンツをMarkdown→HTMLにレンダリングし、CachedItemとして返す。 */
	async renderItem(item: T): Promise<CachedItem<T>> {
		const { client } = this.requireClient();
		return this.buildCachedItem(client, item);
	}

	/** スラッグでコンテンツを取得してMarkdown→HTMLにレンダリングする。 */
	async renderItemBySlug(slug: string): Promise<CachedItem<T> | null> {
		const { client, dataSourceId } = this.requireClient();
		try {
			const page = await queryPageBySlug(
				client,
				dataSourceId,
				slug,
				this.slugPropName,
			);
			if (!page) return null;
			const item = this.itemMapper(page);
			if (
				this.accessibleStatuses.length > 0 &&
				!this.accessibleStatuses.includes(item.status)
			) {
				return null;
			}
			return this.buildCachedItem(client, item);
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "NOTION_FETCH_ITEM_BY_SLUG_FAILED",
				message: "Failed to fetch item by slug from Notion data source.",
				cause: err,
				context: { operation: "renderItemBySlug", dataSourceId, slug },
			});
		}
	}

	// ── キャッシュ操作 ─────────────────────────────────────────────────────

	getCachedItemList(): Promise<CachedItemList<T> | null> {
		return this.store.getItemList();
	}

	setCachedItemList(items: T[]): Promise<void> {
		return this.store.setItemList(items);
	}

	getCachedItem(slug: string): Promise<CachedItem<T> | null> {
		return this.store.getItem(slug);
	}

	setCachedItem(slug: string, data: CachedItem<T>): Promise<void> {
		return this.store.setItem(slug, data);
	}

	getCachedImage(hash: string): Promise<StorageBinary | null> {
		return this.store.getImage(hash);
	}

	async createCachedImageResponse(hash: string): Promise<Response | null> {
		const object = await this.store.getImage(hash);
		if (!object) return null;
		const headers = new Headers();
		if (object.contentType) headers.set("content-type", object.contentType);
		headers.set("cache-control", "public, max-age=31536000, immutable");
		return new Response(object.data, { headers });
	}

	// ── キャッシュ優先取得（Stale-While-Revalidate） ─────────────────────

	async getItemsCachedFirst(options?: {
		waitUntil?: (promise: Promise<void>) => void;
	}): Promise<{ items: T[]; listVersion: string }> {
		const cached = await this.store.getItemList();
		if (cached && !isStale(cached.cachedAt, this.ttlMs)) {
			return {
				items: cached.items,
				listVersion: buildListVersion(cached.items),
			};
		}

		const items = await this.getItems();
		const save = this.store.setItemList(items);
		if (options?.waitUntil) {
			options.waitUntil(save);
		} else {
			await save;
		}
		return { items, listVersion: buildListVersion(items) };
	}

	async getItemCachedFirst(
		slug: string,
		options?: { waitUntil?: (promise: Promise<void>) => void },
	): Promise<CachedItem<T> | null> {
		const cached = await this.store.getItem(slug);
		if (cached && !isStale(cached.cachedAt, this.ttlMs)) return cached;

		const entry = await this.renderItemBySlug(slug);
		if (!entry) return null;

		const save = this.store.setItem(slug, entry);
		if (options?.waitUntil) {
			options.waitUntil(save);
		} else {
			await save;
		}
		return entry;
	}

	async checkItemsUpdate(
		clientVersion: string,
	): Promise<{ changed: false } | { changed: true; items: T[] }> {
		const items = await this.getItems();
		const serverVersion = buildListVersion(items);
		if (serverVersion === clientVersion) return { changed: false };
		await this.store.setItemList(items);
		return { changed: true, items };
	}

	async checkItemUpdate(
		slug: string,
		lastEdited: string,
	): Promise<
		| { changed: false }
		| { changed: true; html: string; item: T; notionUpdatedAt: string }
	> {
		const item = await this.getItemBySlug(slug);
		if (!item) return { changed: false };
		if (!this.isPublished(item)) return { changed: false };
		if (item.updatedAt === lastEdited) return { changed: false };

		const entry = await this.renderItemBySlug(slug);
		if (!entry) return { changed: false };
		await this.store.setItem(slug, entry);

		return {
			changed: true,
			html: entry.html,
			item: entry.item,
			notionUpdatedAt: entry.notionUpdatedAt,
		};
	}

	// ── プライベートヘルパー ───────────────────────────────────────────────

	private async buildCachedItem(
		client: Client,
		item: T,
	): Promise<CachedItem<T>> {
		const transformer = new Transformer(
			this.transformerConfig?.blocks
				? { blocks: this.transformerConfig.blocks }
				: undefined,
		);

		let markdown: string;
		try {
			markdown = await transformer.transform(client, item.id);
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "NOTION_MARKDOWN_FETCH_FAILED",
				message: "Failed to load markdown from Notion.",
				cause: err,
				context: {
					operation: "buildCachedItem:transform",
					pageId: item.id,
					slug: item.slug,
				},
			});
		}

		const cacheImage = this.hasStorage
			? buildCacheImageFn(this.store, this.imageProxyBase)
			: undefined;

		let html: string;
		try {
			html = await renderMarkdown(markdown, {
				imageProxyBase: this.imageProxyBase,
				cacheImage,
				remarkPlugins: this.rendererConfig?.remarkPlugins,
				rehypePlugins: this.rendererConfig?.rehypePlugins,
				render: this.rendererConfig?.render,
			});
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "RENDERER_FAILED",
				message: "Failed to render markdown.",
				cause: err,
				context: {
					operation: "buildCachedItem:renderMarkdown",
					pageId: item.id,
					slug: item.slug,
				},
			});
		}

		return {
			html,
			item,
			notionUpdatedAt: item.updatedAt,
			cachedAt: Date.now(),
		};
	}
}

/** 設定済みのCMSインスタンスを生成するファクトリ関数。 */
export function createCMS<T extends BaseContentItem = BaseContentItem>(
	config?: CMSConfig<T>,
): CMS<T> {
	return new CMS<T>(config);
}
