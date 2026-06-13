import type {
  BaseContentItem,
  CMSSchemaProperties,
  ContentBlock,
  DataSource,
  InvalidateScope,
  PropertyMap,
  WebhookConfig,
} from "@notion-headless-cms/core";
import {
  CMSError,
  isCMSError,
  normalizePageId,
} from "@notion-headless-cms/core";
import { Transformer } from "@notion-headless-cms/markdown-html";
import { type DataSourceObjectResponse, isFullPage } from "@notionhq/client";
import { fetchBlockTree, type NotionBlockTreeNode } from "./block-tree";
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

/** Notion API の 404（object_not_found）か判定する。 */
function isNotionNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; status?: number };
  return e.code === "object_not_found" || e.status === 404;
}

/** ページ parent が指定の data source（または database）に属するか。 */
function pageBelongsToDataSource(
  parent: unknown,
  dataSourceId: string,
): boolean {
  if (!parent || typeof parent !== "object") return false;
  const p = parent as { data_source_id?: string; database_id?: string };
  const target = normalizePageId(dataSourceId);
  if (p.data_source_id) return normalizePageId(p.data_source_id) === target;
  if (p.database_id) return normalizePageId(p.database_id) === target;
  return false;
}

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
   * Notion 本文の取得戦略。`@notion-headless-cms/fetch-blocks` や
   * `@notion-headless-cms/fetch-markdown` のファクトリ関数の戻り値を渡す。
   * 未指定の場合は動的 import で `fetch-blocks` の `blocksFetcher()` にフォールバックする。
   */
  content?: ContentFetcher;
  /**
   * このコレクションの論理名 (例: `"posts"`)。`parseWebhook` が返す
   * `InvalidateScope.collection` に使う。`notionSource()` がスキーマのキーを渡す。
   * 未指定時は DataSource 名 (`"notion"`) を使う。
   */
  collectionName?: string;
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
  /** parseWebhook が返す InvalidateScope.collection に使う論理名。 */
  private readonly collectionName: string | undefined;
  private readonly client: ReturnType<typeof createClient>;
  private readonly dbName: string | undefined;
  private resolvedDataSourceId: string | undefined;
  private resolvingDataSourceId: Promise<string> | undefined;
  private readonly itemMapper: (page: NotionPage) => T;
  private readonly token: string;
  // 動的 fallback 用に保持。明示的に渡された場合は最初から content が入る。
  private content: ContentFetcher | undefined;
  private resolvingContent: Promise<ContentFetcher> | undefined;
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
    this.collectionName = opts.collectionName;

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

  async findById(pageId: string): Promise<T | null> {
    let page: Awaited<ReturnType<typeof this.client.pages.retrieve>>;
    try {
      page = await this.client.pages.retrieve({ page_id: pageId });
    } catch (err) {
      // 他 DB のページ・削除済みは 404。webhook は対象外イベントも送るため null で無視する。
      if (isNotionNotFound(err)) return null;
      if (isCMSError(err)) throw err;
      throw new CMSError({
        code: "source/fetch_item_failed",
        message: "Failed to retrieve page by id from Notion.",
        cause: err,
        context: { operation: "NotionCollection.findById", pageId },
      });
    }
    if (!isFullPage(page)) return null;
    // この data source に属さないページは別コレクション扱い（誤ウォーム防止）。
    const dataSourceId = await this.getDataSourceId();
    if (!pageBelongsToDataSource(page.parent, dataSourceId)) return null;
    return this.itemMapper(page);
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
    const fetcher: ContentFetcher = {
      kind: "blocks",
      async loadMarkdown(client, pageId) {
        return new Transformer().transform(client, pageId);
      },
      async loadNotionBlocks(client, pageId) {
        return fetchBlockTree(client, pageId);
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

  /**
   * Webhook リクエストを検証し、無効化スコープを返す。
   *
   * collection はハンドラ側で URL から決まり (`POST {basePath}/revalidate/:collection`)、
   * この DataSource が呼ばれる時点で確定している。ここでは:
   *
   * 1. `config.secret` が設定されていれば共有シークレットを検証する。
   *    提示方法は `?secret=<値>` クエリ / `X-Webhook-Secret` ヘッダ / `Authorization: Bearer <値>` の
   *    いずれか。Notion の Automation Webhook は送信先 URL を自由に設定できるためクエリが実用的。
   * 2. body を解析する。`{ "slug": "..." }` を含むペイロードならそのスラッグだけを無効化し、
   *    それ以外 (空 body / page id のみ等) はコレクション全体を無効化する (安全側)。
   *
   * Notion の HMAC 署名検証など独自方式が必要な場合は、`DataSource.parseWebhook` を
   * 自前実装で差し替える (このメソッドは optional インターフェースの既定実装)。
   */
  async parseWebhook(
    req: Request,
    config: WebhookConfig,
  ): Promise<InvalidateScope> {
    const collection = this.collectionName ?? this.name;

    if (config.secret) {
      const provided = extractWebhookSecret(req);
      if (!provided || !timingSafeEqual(provided, config.secret)) {
        throw new CMSError({
          code: "webhook/signature_invalid",
          message: "Webhook secret が一致しません。",
          context: { operation: "NotionCollection.parseWebhook", collection },
        });
      }
    }

    // body が空ならコレクション全体を無効化する (Notion 標準 Webhook には slug が無い)。
    const raw = await req.text().catch(() => "");
    if (!raw.trim()) return { collection };

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      throw new CMSError({
        code: "webhook/payload_invalid",
        message: "Webhook ペイロードが JSON として解析できません。",
        cause: err,
        context: { operation: "NotionCollection.parseWebhook", collection },
      });
    }

    // 明示的に slug を送ってくれた場合のみ対象を絞る。それ以外は全体無効化。
    if (
      payload &&
      typeof payload === "object" &&
      "slug" in payload &&
      typeof (payload as { slug: unknown }).slug === "string" &&
      (payload as { slug: string }).slug.length > 0
    ) {
      return { collection, slug: (payload as { slug: string }).slug };
    }
    return { collection };
  }
}

/** Webhook リクエストから提示シークレットを取り出す (クエリ / ヘッダ / Bearer)。 */
function extractWebhookSecret(req: Request): string | undefined {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("secret");
  if (fromQuery) return fromQuery;
  const header = req.headers.get("x-webhook-secret");
  if (header) return header;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return undefined;
}

/** 長さ非依存に近い文字列比較。タイミング攻撃の表面積を小さくする。 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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
