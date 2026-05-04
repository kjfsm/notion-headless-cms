import type {
  BaseContentItem,
  CMSSchemaProperties,
  ContentBlock,
  DataSource,
  PropertyMap,
} from "@notion-headless-cms/core";
import { CMSError, isCMSError } from "@notion-headless-cms/core";
import type { BlockHandler } from "@notion-headless-cms/renderer";
import { Transformer } from "@notion-headless-cms/renderer";
import type { DataSourceObjectResponse } from "@notionhq/client";
import { fetchBlockTree, type NotionBlockTreeNode } from "./block-tree";
import {
  createClient,
  queryAllPages,
  queryPageByProp,
} from "./internal/fetcher/index";
import { markdownToBlocks } from "./internal/md-to-blocks";
import { mapItem, mapItemFromPropertyMap } from "./mapper";
import type { NotionSchema } from "./schema";
import type { NotionPage } from "./types";

const DEFAULT_PROPERTIES: Required<CMSSchemaProperties> = {
  slug: "Slug",
  status: "Status",
  date: "CreatedAt",
};

interface NotionCollectionCommonOptions {
  /** Notion API 認証トークン。 */
  token: string;
  /**
   * Notion データベース (データソース) ID。
   * `dbName` を指定する場合は省略可能 (最初のアクセス時に解決される)。
   */
  dataSourceId?: string;
  /**
   * Notion データベース名。`dataSourceId` の代わりに指定すると、
   * 最初の API 呼び出し時に `client.search` で解決される (結果はキャッシュ)。
   */
  dbName?: string;
  /** カスタムブロックハンドラーのマップ。 */
  blocks?: Record<string, BlockHandler>;
}

/** デフォルトマッパー利用時 (T = BaseContentItem) の入力。 */
export interface NotionCollectionDefaultOptions
  extends NotionCollectionCommonOptions {
  properties?: CMSSchemaProperties;
}

/** カスタム `mapItem` で任意の T に写像するときの入力。 */
export interface NotionCollectionMapItemOptions<T extends BaseContentItem>
  extends NotionCollectionCommonOptions {
  properties?: CMSSchemaProperties;
  mapItem: (page: NotionPage) => T;
}

/** 宣言的スキーマ (`defineSchema()`) で任意の T に写像するときの入力。 */
export interface NotionCollectionSchemaOptions<T extends BaseContentItem>
  extends NotionCollectionCommonOptions {
  schema: NotionSchema<T>;
}

/**
 * CLI が生成した `*Properties` オブジェクトを使うオプション。
 * ページ構成の知識（slug/status の意味）を持たない型付きNotionクライアント。
 * slug/status/publishedStatuses は `createCMS({ collections })` で指定する。
 */
export interface NotionCollectionPropertiesOptions
  extends NotionCollectionCommonOptions {
  properties: PropertyMap;
}

export type NotionCollectionOptions<
  T extends BaseContentItem = BaseContentItem,
> =
  | NotionCollectionDefaultOptions
  | NotionCollectionMapItemOptions<T>
  | NotionCollectionSchemaOptions<T>
  | NotionCollectionPropertiesOptions;

/** Notion を `DataSource<T>` として実装するコレクションクラス。 */
class NotionCollection<T extends BaseContentItem = BaseContentItem>
  implements DataSource<T>
{
  readonly name = "notion";
  /** CLI 生成の `*Properties` に対応するプロパティマップ。properties オプション使用時のみ設定される。 */
  readonly properties?: PropertyMap;
  private readonly client: ReturnType<typeof createClient>;
  private readonly dbName: string | undefined;
  private resolvedDataSourceId: string | undefined;
  private resolvingDataSourceId: Promise<string> | undefined;
  private readonly itemMapper: (page: NotionPage) => T;
  private readonly blocksConfig: Record<string, BlockHandler> | undefined;

  constructor(opts: NotionCollectionOptions<T>) {
    if (!opts.dataSourceId && !opts.dbName) {
      throw new CMSError({
        code: "core/config_invalid",
        message:
          "NotionCollection requires either `dataSourceId` or `dbName` to be set.",
        context: { operation: "NotionCollection.constructor" },
      });
    }
    this.client = createClient({ NOTION_TOKEN: opts.token });
    this.resolvedDataSourceId = opts.dataSourceId;
    this.dbName = opts.dbName;
    this.blocksConfig = opts.blocks;

    if ("schema" in opts && opts.schema) {
      this.itemMapper = opts.schema.mapItem;
    } else if ("mapItem" in opts && opts.mapItem) {
      this.itemMapper = opts.mapItem;
    } else if ("properties" in opts && opts.properties && !("fields" in opts)) {
      // CLI 生成の PropertyMap を使う新形式。
      // slug/status/publishedStatuses はページ構成の知識を持たないため設定しない。
      // createCMS({ collections }) で指定する。
      const propMap = opts.properties as PropertyMap;
      this.properties = propMap;
      this.itemMapper = ((page: NotionPage) =>
        mapItemFromPropertyMap(page, propMap)) as (page: NotionPage) => T;
    } else {
      const props: Required<CMSSchemaProperties> = {
        ...DEFAULT_PROPERTIES,
        ...("properties" in opts
          ? (opts.properties as CMSSchemaProperties)
          : undefined),
      };
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
        context: { operation: "NotionCollection.getDataSourceId" },
      });
    }
    this.resolvingDataSourceId = (async () => {
      const response = await this.client.search({
        query: dbName,
        filter: { property: "object", value: "data_source" },
      });
      for (const result of response.results) {
        if (result.object !== "data_source") continue;
        const ds = result as DataSourceObjectResponse;
        const title = ds.title.map((t) => t.plain_text).join("");
        if (title === dbName) {
          this.resolvedDataSourceId = ds.id;
          return ds.id;
        }
      }
      // 部分一致の結果はあっても完全一致しない場合は意図しないDBを掴むリスクがあるためエラーにする
      throw new CMSError({
        code: "source/fetch_items_failed",
        message: `Notion データベース "${dbName}" が見つかりませんでした。インテグレーションが DB にアクセスできるか確認してください。`,
        context: { operation: "NotionCollection.getDataSourceId", dbName },
      });
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
                item.status != null &&
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
          operation: "NotionCollection.list",
          dataSourceId: this.resolvedDataSourceId,
          dbName: this.dbName,
        },
      });
    }
  }

  async findByProp(notionPropName: string, value: string): Promise<T | null> {
    try {
      const dataSourceId = await this.getDataSourceId();
      const page = await queryPageByProp(
        this.client,
        dataSourceId,
        notionPropName,
        value,
      );
      if (!page) return null;
      return this.itemMapper(page);
    } catch (err) {
      if (isCMSError(err)) throw err;
      throw new CMSError({
        code: "source/fetch_item_failed",
        message: "Failed to fetch item by property from Notion data source.",
        cause: err,
        context: {
          operation: "NotionCollection.findByProp",
          dataSourceId: this.resolvedDataSourceId,
          dbName: this.dbName,
          notionPropName,
          value,
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
          operation: "NotionCollection.loadMarkdown",
          pageId: item.id,
          slug: item.slug,
        },
      });
    }
  }

  async loadBlocks(item: T): Promise<ContentBlock[]> {
    const markdown = await this.loadMarkdown(item);
    return markdownToBlocks(markdown);
  }

  async loadNotionBlocks(item: T): Promise<NotionBlockTreeNode[]> {
    try {
      return await fetchBlockTree(this.client, item.id);
    } catch (err) {
      if (isCMSError(err)) throw err;
      throw new CMSError({
        code: "source/load_blocks_failed",
        message: "Failed to load Notion block tree.",
        cause: err,
        context: {
          operation: "NotionCollection.loadNotionBlocks",
          pageId: item.id,
          slug: item.slug,
        },
      });
    }
  }

  getLastModified(item: T): string {
    return item.lastEditedTime;
  }

  getListVersion(items: T[]): string {
    return items.map((item) => `${item.id}:${item.lastEditedTime}`).join("|");
  }
}

/** デフォルトマッパーで `BaseContentItem` を返す Notion コレクションを生成する。 */
export function createNotionCollection(
  opts: NotionCollectionDefaultOptions,
): DataSource<BaseContentItem>;
/** カスタム `mapItem` で任意の `T` に写像する Notion コレクションを生成する。 */
export function createNotionCollection<T extends BaseContentItem>(
  opts: NotionCollectionMapItemOptions<T>,
): DataSource<T>;
/** 宣言的 `schema` で任意の `T` に写像する Notion コレクションを生成する。 */
export function createNotionCollection<T extends BaseContentItem>(
  opts: NotionCollectionSchemaOptions<T>,
): DataSource<T>;
/**
 * CLI 生成の `*Properties` オブジェクトを使う新形式。
 * ページ構成の知識（slug/status/publishedStatuses の意味）を持たず、
 * すべての設定は `createCMS({ collections })` で行う。
 */
export function createNotionCollection(
  opts: NotionCollectionPropertiesOptions,
): DataSource<BaseContentItem>;
export function createNotionCollection<
  T extends BaseContentItem = BaseContentItem,
>(opts: NotionCollectionOptions<T>): DataSource<T> {
  return new NotionCollection<T>(opts);
}
