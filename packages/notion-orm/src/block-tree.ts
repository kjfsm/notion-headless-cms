import type { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  BookmarkBlockObjectResponse,
  EmbedBlockObjectResponse,
  LinkPreviewBlockObjectResponse,
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
/** OGP メタデータを付与した link_preview ブロック。 */
export type LinkPreviewBlockWithOgp = LinkPreviewBlockObjectResponse & {
  ogp?: OgpData;
};

/**
 * children を再帰的に解決済みのブロック木。
 * react-renderer など「ページ全体を 1 ツリーで受け取りたい」描画側が消費する。
 * embed / bookmark / link_preview は OGP オプションを有効化すると `ogp` フィールドが付く。
 */
export type NotionBlockTreeNode = (
  | Exclude<
      BlockObjectResponse,
      | EmbedBlockObjectResponse
      | BookmarkBlockObjectResponse
      | LinkPreviewBlockObjectResponse
    >
  | EmbedBlockWithOgp
  | BookmarkBlockWithOgp
  | LinkPreviewBlockWithOgp
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
  /**
   * 同時に展開する子ブロックの最大数。デフォルト 3。
   * Notion API のレート制限 (3 req/s) に抵触しないよう抑制する。
   */
  concurrency?: number;
}

/**
 * ブロック木に対して追加情報を付与する enricher 関数。
 * `createNotionCollection` の `enrichers` オプションに渡す。
 * `notion-katex` など拡張パッケージが実装する。
 */
export type BlockEnricher = (
  blocks: NotionBlockTreeNode[],
) => Promise<NotionBlockTreeNode[]> | NotionBlockTreeNode[];

/**
 * ページ ID 配下の全ブロックを再帰的に取得し、children をネストした木として返す。
 * `opts.ogp.enabled` が true の場合、embed / bookmark / link_preview ブロックに OGP メタデータを付与する。
 */
export async function fetchBlockTree(
  client: Client,
  pageId: string,
  opts?: FetchBlockTreeOptions,
): Promise<NotionBlockTreeNode[]> {
  // セマフォをルートで生成し、全再帰レベルで共有することで
  // ネストが深いページでも同時 API 呼び出し数をグローバルに制限する。
  const sem = new Semaphore(opts?.concurrency ?? 3);
  return fetchWithSemaphore(client, pageId, opts, sem);
}

async function fetchWithSemaphore(
  client: Client,
  pageId: string,
  opts: FetchBlockTreeOptions | undefined,
  sem: Semaphore,
): Promise<NotionBlockTreeNode[]> {
  await sem.acquire();
  let blocks: BlockObjectResponse[];
  try {
    blocks = await getBlocks(client, pageId);
  } finally {
    sem.release();
  }

  const tree = await Promise.all(
    blocks.map((block) => expandChildren(client, block, sem)),
  );
  if (opts?.ogp?.enabled) {
    await enrichWithOgp(tree, opts.ogp, sem);
  }
  return tree;
}

async function expandChildren(
  client: Client,
  block: BlockObjectResponse,
  sem: Semaphore,
): Promise<NotionBlockTreeNode> {
  if (!block.has_children) {
    return block as NotionBlockTreeNode;
  }
  // 子要素の OGP enrich は親側でまとめて行うため、再帰呼び出しでは ogp オプションを外す。
  const children = await fetchWithSemaphore(client, block.id, undefined, sem);
  return { ...block, children } as NotionBlockTreeNode;
}

/**
 * ツリー全体を走査して embed / bookmark / link_preview ブロックの URL を集め、並列に OGP fetch して付与する。
 */
async function enrichWithOgp(
  tree: NotionBlockTreeNode[],
  ogp: FetchBlockTreeOgpOptions,
  sem: Semaphore,
): Promise<void> {
  const targets: Array<
    EmbedBlockWithOgp | BookmarkBlockWithOgp | LinkPreviewBlockWithOgp
  > = [];
  collectOgpTargets(tree, targets);
  if (targets.length === 0) return;

  const memo = createOgpFetcher({ ttlMs: ogp.ttlMs });

  await Promise.all(
    targets.map(async (block) => {
      const url =
        block.type === "embed"
          ? block.embed.url
          : block.type === "bookmark"
            ? block.bookmark.url
            : block.link_preview.url;
      if (!url) return;
      await sem.acquire();
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
      } finally {
        sem.release();
      }
    }),
  );
}

/**
 * 同時実行数を制限するセマフォ。
 * acquire() で空きスロットを取得し、release() で返却する。
 * キューに積まれた待機 Promise は FIFO で解決される。
 */
class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(concurrency: number) {
    this.available = concurrency;
  }

  acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
    } else {
      this.available++;
    }
  }
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
  out: Array<
    EmbedBlockWithOgp | BookmarkBlockWithOgp | LinkPreviewBlockWithOgp
  >,
): void {
  for (const node of nodes) {
    if (node.type === "embed") {
      out.push(node as EmbedBlockWithOgp);
    } else if (node.type === "bookmark") {
      out.push(node as BookmarkBlockWithOgp);
    } else if (node.type === "link_preview") {
      out.push(node as LinkPreviewBlockWithOgp);
    }
    if (node.children?.length) collectOgpTargets(node.children, out);
  }
}
