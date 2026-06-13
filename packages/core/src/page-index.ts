import type { CollectionClient } from "./types/collection";
import type { BaseContentItem } from "./types/content";

/** 逆引きの解決先。Notion ページ ID から自サイトの位置を引く。 */
export interface PageIndexEntry {
  /** 所属コレクション名。 */
  collection: string;
  /** URL キー。要素コレクション（slug 無し）は index に含まれないため常に存在する。 */
  slug: string;
  /** ページ名（表示テキスト用）。 */
  title?: string | null;
}

/** `buildPageIndex` が返す逆引きマップ。キーは `normalizePageId` 済みの pageId。 */
export type PageIndex = Map<string, PageIndexEntry>;

/**
 * `buildPageIndex` / `buildPageLinkMap` が必要とする最小の CMS 形状。
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
 *
 * react-renderer 側も同一実装で `pageLinks` を引くため、変更時は両方を揃えること。
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
 * `list()` は SWR ドキュメントキャッシュ経由のためウォーム後は安価。
 */
export async function buildPageIndex(
  source: PageIndexSource,
  opts?: BuildPageIndexOptions,
): Promise<PageIndex> {
  // collections を持たない / 異常な source でもクラッシュさせず空マップを返す。
  const names = opts?.collections ?? source.collections;
  const index: PageIndex = new Map();
  if (
    !names ||
    typeof (names as Iterable<string>)[Symbol.iterator] !== "function"
  ) {
    return index;
  }
  for (const name of names) {
    const client = asCollectionClient(source, name);
    if (!client) continue;
    const items = await client.list();
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      // URL を持たない要素（slug 無し）はリンク解決対象外なので index に入れない。
      const slug = item.slug;
      if (slug == null) continue;
      // pageId は一意なので衝突しない前提。万一重複しても先勝ちで保持する。
      const key = normalizePageId(item.id);
      if (!index.has(key)) {
        index.set(key, {
          collection: name,
          slug,
          title: item.title,
        });
      }
    }
  }
  return index;
}

/** 解決済みの内部リンク。`href` は構築時に決まり、`title` は表示テキスト用。 */
export interface ResolvedPageLink {
  href: string;
  title?: string | null;
}

/**
 * 正規化済み pageId → 解決済みリンクのプレーンマップ。
 * 関数ではなくプレーンオブジェクトなので、loader / RSC（Server Component → Client
 * Component）境界を越えて `<NotionRenderer pageLinks={...} />` にそのまま渡せる。
 */
export type PageLinkMap = Record<string, ResolvedPageLink>;

export interface BuildPageLinkMapOptions extends BuildPageIndexOptions {
  /**
   * エントリから URL を組み立てる関数。既定は `/${collection}/${slug}`。
   * 単一コレクションで `/${slug}` にしたい場合などに上書きする。
   */
  url?: (entry: PageIndexEntry, pageId: string) => string;
  /** 事前構築済みインデックス。指定するとリクエストごとの再構築を省ける。 */
  index?: PageIndex;
}

const defaultUrl = (entry: PageIndexEntry): string =>
  `/${entry.collection}/${entry.slug}`;

/**
 * Notion 内部リンクを「正規化 pageId → {href, title}」のプレーンマップに解決する。
 * サーバ側（loader / RSC / route handler）で 1 回構築し、`<NotionRenderer pageLinks={...} />`
 * に渡す。プレーンオブジェクトなのでシリアライズ境界（RSC / loader）を越えられる。
 *
 * @example
 * const pageLinks = await buildPageLinkMap(cms);
 * <NotionRenderer blocks={blocks} pageLinks={pageLinks} />;
 */
export async function buildPageLinkMap(
  source: PageIndexSource,
  opts?: BuildPageLinkMapOptions,
): Promise<PageLinkMap> {
  const index = opts?.index ?? (await buildPageIndex(source, opts));
  const toUrl = opts?.url ?? defaultUrl;
  const map: PageLinkMap = {};
  for (const [key, entry] of index) {
    map[key] = { href: toUrl(entry, key), title: entry.title };
  }
  return map;
}
