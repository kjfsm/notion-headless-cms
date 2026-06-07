import type { CollectionClient } from "./types/collection";
import type { BaseContentItem } from "./types/content";

/** 逆引きの解決先。Notion ページ ID から自サイトの位置を引く。 */
export interface PageIndexEntry {
  /** 所属コレクション名。 */
  collection: string;
  /** URL キー。 */
  slug: string;
  /** ページ名（表示テキスト用）。 */
  title?: string | null;
}

/** `buildPageIndex` が返す逆引きマップ。キーは `normalizePageId` 済みの pageId。 */
export type PageIndex = Map<string, PageIndexEntry>;

/**
 * `buildPageIndex` / `createPageLinkResolver` が必要とする最小の CMS 形状。
 * `collections` でコレクション名を列挙し、各名でコレクションクライアントへアクセスする。
 * `CMSClient` はコレクションを自身に spread しているため構造的に満たす。
 */
export interface PageIndexSource {
  readonly collections: readonly string[];
}

export interface BuildPageIndexOptions {
  /** 走査対象のコレクション名。未指定なら `source.collections` 全件。 */
  collections?: readonly string[];
}

/**
 * Notion ページ ID を比較用に正規化する。
 * Notion の ID は文脈によりダッシュの有無・大文字小文字が揺れるため、
 * ダッシュ除去 + 小文字化して突き合わせる。
 */
export function normalizePageId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

function asCollectionClient(
  source: PageIndexSource,
  name: string,
): CollectionClient<BaseContentItem> | undefined {
  const client = (source as unknown as Record<string, unknown>)[name] as
    | CollectionClient<BaseContentItem>
    | undefined;
  // collections に名前はあっても spread されていない / list を持たない値は無視する。
  if (!client || typeof client.list !== "function") return undefined;
  return client;
}

/**
 * 全コレクションを `list()` で走査し、pageId → {collection, slug, title} の逆引きマップを構築する。
 * Notion 内部リンク（link_to_page / page mention など）を自サイト URL へ解決するための材料。
 *
 * `list()` は SWR ドキュメントキャッシュ経由のためウォーム後は安価。リクエストごとに
 * 構築し直したくない場合は結果を呼び出し側で保持し `createPageLinkResolver({ index })` に渡す。
 */
export async function buildPageIndex(
  source: PageIndexSource,
  opts?: BuildPageIndexOptions,
): Promise<PageIndex> {
  const names = opts?.collections ?? source.collections;
  const index: PageIndex = new Map();
  for (const name of names) {
    const client = asCollectionClient(source, name);
    if (!client) continue;
    const items = await client.list();
    for (const item of items) {
      // pageId は一意なので衝突しない前提。万一重複しても先勝ちで保持する。
      const key = normalizePageId(item.id);
      if (!index.has(key)) {
        index.set(key, {
          collection: name,
          slug: item.slug,
          title: item.title,
        });
      }
    }
  }
  return index;
}

export interface PageLinkResolverOptions extends BuildPageIndexOptions {
  /**
   * エントリから URL を組み立てる関数。既定は `/${collection}/${slug}`。
   * 単一コレクションで `/${slug}` にしたい場合などに上書きする。
   */
  url?: (entry: PageIndexEntry, pageId: string) => string;
  /** 事前構築済みインデックス。指定するとリクエストごとの再構築を省ける。 */
  index?: PageIndex;
}

/** react-renderer の `resolvePageUrl` / `resolvePageTitle` に渡す関数ペア。 */
export interface PageLinkResolver {
  resolvePageUrl: (pageId: string) => string | undefined;
  resolvePageTitle: (pageId: string) => string | undefined;
}

const defaultUrl = (entry: PageIndexEntry): string =>
  `/${entry.collection}/${entry.slug}`;

/**
 * Notion 内部リンクを自サイト URL に解決する関数ペアを生成する。
 * サーバ側で 1 回生成し、`<NotionRenderer blocks={...} {...resolver} />` のように spread して使う。
 * 未登録ページ（CMS のコレクションに無い ID）は `undefined` を返し、renderer 側の従来
 * フォールバック（`link_to_page` は `#id`、mention は素の表示）に委ねる。
 *
 * @example
 * const resolver = await createPageLinkResolver(cms);
 * <NotionRenderer blocks={blocks} {...resolver} />;
 */
export async function createPageLinkResolver(
  source: PageIndexSource,
  opts?: PageLinkResolverOptions,
): Promise<PageLinkResolver> {
  const index = opts?.index ?? (await buildPageIndex(source, opts));
  const toUrl = opts?.url ?? defaultUrl;
  return {
    resolvePageUrl(pageId) {
      const entry = index.get(normalizePageId(pageId));
      return entry ? toUrl(entry, pageId) : undefined;
    },
    resolvePageTitle(pageId) {
      return index.get(normalizePageId(pageId))?.title ?? undefined;
    },
  };
}
