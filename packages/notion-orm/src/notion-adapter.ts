import type {
  BaseContentItem,
  CMSSchemaProperties,
  ContentBlock,
  DataSource,
  PropertyMap,
} from "@notion-headless-cms/core";
import { CMSError, isCMSError } from "@notion-headless-cms/core";
import type { BlockHandler } from "@notion-headless-cms/markdown-html";
import { Transformer } from "@notion-headless-cms/markdown-html";
import type { DataSourceObjectResponse } from "@notionhq/client";
import {
  type BlockEnricher,
  type FetchBlockTreeOgpOptions,
  fetchBlockTree,
  type NotionBlockTreeNode,
} from "./block-tree";
import type { ContentFetcher } from "./content-fetcher";
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
  /**
   * カスタムブロックハンドラーのマップ。
   * @deprecated `content: blocksFetcher({ blocks })` に移動してください。v1.0.0 で削除予定。`docs/ja/migration/blocks-ogp-enrichers.md` を参照。
   */
  blocks?: Record<string, BlockHandler>;
  /**
   * ブックマーク/埋め込みブロックの OGP 取得設定。省略時は OGP 非取得。
   * @deprecated `content: blocksFetcher({ ogp })` に移動してください。v1.0.0 で削除予定。`docs/ja/migration/blocks-ogp-enrichers.md` を参照。
   */
  ogp?: FetchBlockTreeOgpOptions;
  /**
   * `loadNotionBlocks()` 時にブロック木へ追加情報を付与する enricher のリスト。
   * `notion-katex` など拡張パッケージが返す enricher を渡す。
   * @deprecated `content: blocksFetcher({ enrichers })` に移動してください。v1.0.0 で削除予定。`docs/ja/migration/blocks-ogp-enrichers.md` を参照。
   */
  enrichers?: readonly BlockEnricher[];
  /**
   * Notion 本文の取得戦略。`@notion-headless-cms/fetch-blocks` や
   * `@notion-headless-cms/fetch-markdown` のファクトリ関数の戻り値を渡す。
   * 未指定の場合は動的 import で `fetch-blocks` の `blocksFetcher()` にフォールバックする。
   */
  content?: ContentFetcher;
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
 * CLI が生成した `*Properties` を直接渡す形式。
 * このコレクション自身は slug/status の意味を持たず、解釈は `createClient({ collections })` 側に委ねる。
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

class NotionCollection<T extends BaseContentItem = BaseContentItem>
  implements DataSource<T>
{
  readonly name = "notion";
  /** properties オプション使用時のみ設定。core 側の `findByProp` 高速化に使われる。 */
  readonly properties?: PropertyMap;
  private readonly client: ReturnType<typeof createClient>;
  private readonly dbName: string | undefined;
  private resolvedDataSourceId: string | undefined;
  private resolvingDataSourceId: Promise<string> | undefined;
  private readonly itemMapper: (page: NotionPage) => T;
  private readonly token: string;
  // 動的 fallback 用に保持。明示的に渡された場合は最初から content が入る。
  private content: ContentFetcher | undefined;
  private resolvingContent: Promise<ContentFetcher> | undefined;
  // 旧トップレベルオプション (deprecated)。fallback の blocksFetcher() に渡して上位互換を保つ。
  private readonly legacyBlocks: Record<string, BlockHandler> | undefined;
  private readonly legacyOgp: FetchBlockTreeOgpOptions | undefined;
  private readonly legacyEnrichers: readonly BlockEnricher[] | undefined;
  // buildCachedItemContent が loadMarkdown / loadBlocks を個別に呼ぶため、
  // 同一リクエスト内で同じページを2回 fetch しないようメモ化する。
  private readonly _markdownMemo = new Map<string, Promise<string>>();

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
    this.token = opts.token;
    this.resolvedDataSourceId = opts.dataSourceId;
    this.dbName = opts.dbName;
    this.content = opts.content;
    this.legacyBlocks = opts.blocks;
    this.legacyOgp = opts.ogp;
    this.legacyEnrichers = opts.enrichers;
    if (
      !opts.content &&
      (opts.blocks || opts.ogp || opts.enrichers) &&
      typeof console !== "undefined"
    ) {
      // 1 リリースの猶予期間: トップレベルの blocks/ogp/enrichers は次メジャーで削除
      console.warn(
        "[notion-headless-cms] `blocks` / `ogp` / `enrichers` をトップレベルに渡す形は deprecated です。" +
          " `content: blocksFetcher({ ... })` に移行してください。",
      );
    }

    if ("schema" in opts && opts.schema) {
      this.itemMapper = opts.schema.mapItem;
    } else if ("mapItem" in opts && opts.mapItem) {
      this.itemMapper = opts.mapItem;
    } else if ("properties" in opts && opts.properties && !("fields" in opts)) {
      // CLI 生成 PropertyMap 形式。slug/status は createClient({ collections }) 側で解釈する
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

  /** dbName 指定時は最初の呼び出しで `client.search` を使って ID を解決し、結果をキャッシュする。 */
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
      // 完全一致を強制: 部分一致を許すと別 DB を掴む事故が起きやすい
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
    const memo = this._markdownMemo.get(item.id);
    if (memo) return memo;
    const promise = this._fetchMarkdown(item);
    this._markdownMemo.set(item.id, promise);
    return promise;
  }

  private async _fetchMarkdown(item: T): Promise<string> {
    const content = await this.getContent();
    try {
      return await content.loadMarkdown(this.client, item.id, {
        token: this.token,
      });
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
    const content = await this.getContent();
    if (!content.loadNotionBlocks) {
      throw new CMSError({
        code: "source/blocks_unsupported",
        message:
          "選択した fetch 戦略 (" +
          content.kind +
          ") は NotionBlockTree 取得を提供していません。" +
          " markdown 戦略で React 描画するには `@notion-headless-cms/fetch-markdown/react` の Renderer を使ってください。",
        context: {
          operation: "NotionCollection.loadNotionBlocks",
          pageId: item.id,
          slug: item.slug,
          fetcherKind: content.kind,
        },
        nextSteps: [
          "BlockObjectResponse ツリーが必要な場合は `content: blocksFetcher()` に切り替える",
          "Markdown 経路を維持する場合は `<Renderer />` (fetch-markdown/react) を使う",
        ],
      });
    }
    try {
      return await content.loadNotionBlocks(this.client, item.id, {
        token: this.token,
      });
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

  /**
   * `content` が未指定の場合は、`@notion-headless-cms/fetch-blocks` を別途
   * import せずとも動くよう、内部で同等の `blocks` 戦略を組み立てて返す。
   * fetch-blocks への static 依存を持つと循環するため、notion-orm 内に閉じた実装。
   */
  private getContent(): Promise<ContentFetcher> {
    if (this.content) return Promise.resolve(this.content);
    if (this.resolvingContent) return this.resolvingContent;
    const legacyBlocks = this.legacyBlocks;
    const legacyOgp = this.legacyOgp;
    const legacyEnrichers = this.legacyEnrichers ?? [];
    const fetcher: ContentFetcher = {
      kind: "blocks",
      async loadMarkdown(client, pageId) {
        const transformer = new Transformer(
          legacyBlocks ? { blocks: legacyBlocks } : undefined,
        );
        return transformer.transform(client, pageId);
      },
      async loadNotionBlocks(client, pageId) {
        let tree = await fetchBlockTree(client, pageId, {
          ...(legacyOgp ? { ogp: legacyOgp } : {}),
        });
        for (const enricher of legacyEnrichers) {
          tree = await enricher(tree);
        }
        return tree;
      },
    };
    this.content = fetcher;
    this.resolvingContent = Promise.resolve(fetcher);
    return this.resolvingContent;
  }

  getLastModified(item: T): string {
    return item.lastEditedTime;
  }

  getListVersion(items: T[]): string {
    return items.map((item) => `${item.id}:${item.lastEditedTime}`).join("|");
  }
}

/**
 * Notion DB を `DataSource<T>` として束ねる。
 *
 * 入力形式は 4 通り:
 * - デフォルト (`BaseContentItem` を返す)
 * - `mapItem` でカスタム T に写像
 * - 宣言的 `schema` (zod + defineMapping)
 * - CLI 生成の `*Properties` (slug/status の解釈は `createClient({ collections })` 側)
 */
export function createNotionCollection(
  opts: NotionCollectionDefaultOptions,
): DataSource<BaseContentItem>;
export function createNotionCollection<T extends BaseContentItem>(
  opts: NotionCollectionMapItemOptions<T>,
): DataSource<T>;
export function createNotionCollection<T extends BaseContentItem>(
  opts: NotionCollectionSchemaOptions<T>,
): DataSource<T>;
export function createNotionCollection(
  opts: NotionCollectionPropertiesOptions,
): DataSource<BaseContentItem>;
export function createNotionCollection<
  T extends BaseContentItem = BaseContentItem,
>(opts: NotionCollectionOptions<T>): DataSource<T> {
  return new NotionCollection<T>(opts);
}
