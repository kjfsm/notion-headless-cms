import type { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  BookmarkBlockObjectResponse,
  EmbedBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { getBlocks } from "./internal/fetcher/blocks.js";
import {
  cacheOgImage,
  createOgpFetcher,
  type OgpData,
  type OgpFetchOptions,
  type OgpImageCacheBinding,
  type OgpJsonCache,
} from "./ogp.js";

/** OGP メタデータを付与した embed ブロック。 */
export type EmbedBlockWithOgp = EmbedBlockObjectResponse & { ogp?: OgpData };
/** OGP メタデータを付与した bookmark ブロック。 */
export type BookmarkBlockWithOgp = BookmarkBlockObjectResponse & {
  ogp?: OgpData;
};

/**
 * children を再帰的に解決済みのブロック木。
 * react-renderer など「ページ全体を 1 ツリーで受け取りたい」描画側が消費する。
 * embed / bookmark は OGP オプションを有効化すると `ogp` フィールドが付く。
 */
export type NotionBlockTreeNode = (
  | Exclude<
      BlockObjectResponse,
      EmbedBlockObjectResponse | BookmarkBlockObjectResponse
    >
  | EmbedBlockWithOgp
  | BookmarkBlockWithOgp
) & {
  children?: NotionBlockTreeNode[];
};

/** `fetchBlockTree` の OGP オプション。 */
export interface FetchBlockTreeOgpOptions extends OgpFetchOptions {
  /** OGP 取得を有効にする。既定 false。 */
  enabled: boolean;
  /** 永続化向け OGP JSON キャッシュ。未指定時はインメモリ TTL のみ。 */
  jsonCache?: OgpJsonCache;
  /** OG 画像のキャッシュ設定。未指定時は元 URL をそのまま流す。 */
  imageCache?: OgpImageCacheBinding;
}

/** `fetchBlockTree` の追加オプション。 */
export interface FetchBlockTreeOptions {
  ogp?: FetchBlockTreeOgpOptions;
}

/**
 * ページ ID 配下の全ブロックを再帰的に取得し、children をネストした木として返す。
 * `opts.ogp.enabled` が true の場合、embed / bookmark ブロックに OGP メタデータを付与する。
 */
export async function fetchBlockTree(
  client: Client,
  pageId: string,
  opts?: FetchBlockTreeOptions,
): Promise<NotionBlockTreeNode[]> {
  const blocks = await getBlocks(client, pageId);
  const tree = await Promise.all(
    blocks.map(async (block) => expandChildren(client, block)),
  );
  if (opts?.ogp?.enabled) {
    await enrichWithOgp(tree, opts.ogp);
  }
  return tree;
}

async function expandChildren(
  client: Client,
  block: BlockObjectResponse,
): Promise<NotionBlockTreeNode> {
  if (!block.has_children) {
    return block as NotionBlockTreeNode;
  }
  // 子要素の OGP enrich は親側でまとめて行うため、再帰呼び出しでは ogp オプションを外す。
  const children = await fetchBlockTree(client, block.id);
  return { ...block, children } as NotionBlockTreeNode;
}

/**
 * ツリー全体を走査して embed / bookmark ブロックの URL を集め、並列に OGP fetch して付与する。
 */
async function enrichWithOgp(
  tree: NotionBlockTreeNode[],
  ogp: FetchBlockTreeOgpOptions,
): Promise<void> {
  const targets: Array<EmbedBlockWithOgp | BookmarkBlockWithOgp> = [];
  collectOgpTargets(tree, targets);
  if (targets.length === 0) return;

  const memo = createOgpFetcher({ ttlMs: ogp.ttlMs });

  await Promise.all(
    targets.map(async (block) => {
      const url = block.type === "embed" ? block.embed.url : block.bookmark.url;
      if (!url) return;
      try {
        const data = await loadOgp(url, ogp, memo);
        if (data.image && ogp.imageCache) {
          data.image = await cacheOgImage(data.image, ogp.imageCache);
        }
        block.ogp = data;
      } catch (err) {
        ogp.imageCache?.logger?.warn?.(
          `[notion-orm] OG fetch failed for ${url}: ${(err as Error).message}`,
        );
      }
    }),
  );
}

async function loadOgp(
  url: string,
  ogp: FetchBlockTreeOgpOptions,
  memo: (u: string, o?: OgpFetchOptions) => Promise<OgpData>,
): Promise<OgpData> {
  if (ogp.jsonCache) {
    const cached = await ogp.jsonCache.get(url);
    if (cached) return cached;
    const data = await memo(url, { userAgent: ogp.userAgent });
    await ogp.jsonCache.set(url, data);
    return data;
  }
  return memo(url, { userAgent: ogp.userAgent });
}

function collectOgpTargets(
  nodes: NotionBlockTreeNode[],
  out: Array<EmbedBlockWithOgp | BookmarkBlockWithOgp>,
): void {
  for (const node of nodes) {
    if (node.type === "embed") {
      out.push(node as EmbedBlockWithOgp);
    } else if (node.type === "bookmark") {
      out.push(node as BookmarkBlockWithOgp);
    }
    if (node.children?.length) collectOgpTargets(node.children, out);
  }
}
