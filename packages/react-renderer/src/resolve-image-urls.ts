import type { NotionBlock } from "./types";

export type CacheImageFn = (url: string) => Promise<string>;

/**
 * `NotionBlock` ツリーを走査し、画像系 block の URL を `cacheImage` 経由で
 * プロキシ URL へ書き換えた**新しい**ツリーを返す。
 *
 * - `cacheImage` 未指定または対応外ブロックは入力をそのまま素通し
 * - file 型のみ書き換える (external 型は Notion 経由ではないため触らない)
 * - children は再帰的に処理し、入力ツリーをミューテートしない
 *
 * Notion 署名 URL は約 1 時間で失効するため、サーバー側で事前にプロキシ URL に
 * 差し替えてから React コンポーネントに渡すことで、レンダリングを同期保てる。
 */
export async function resolveBlockImageUrls(
  blocks: NotionBlock[],
  cacheImage: CacheImageFn | undefined,
): Promise<NotionBlock[]> {
  if (!cacheImage) return blocks;
  return Promise.all(blocks.map((block) => resolveBlock(block, cacheImage)));
}

async function resolveBlock(
  block: NotionBlock,
  cacheImage: CacheImageFn,
): Promise<NotionBlock> {
  let next = await rewriteFileBlock(block, cacheImage);
  if (next.children && next.children.length > 0) {
    const children = await Promise.all(
      next.children.map((child) => resolveBlock(child, cacheImage)),
    );
    next = { ...next, children };
  }
  return next;
}

const FILE_BLOCK_KEYS = ["image", "video", "audio", "file", "pdf"] as const;

interface FilePayload {
  type: "file" | "external";
  file?: { url: string; expiry_time?: string };
  external?: { url: string };
}

/**
 * Notion API の `image` / `video` / `audio` / `file` / `pdf` block は
 * 同じ `{ type: "file" | "external", file?, external?, caption }` 形状を持つ。
 * file 型のみ URL を書き換える。
 */
async function rewriteFileBlock(
  block: NotionBlock,
  cacheImage: CacheImageFn,
): Promise<NotionBlock> {
  const record = block as unknown as Record<string, unknown>;
  for (const key of FILE_BLOCK_KEYS) {
    const payload = record[key];
    if (!isFilePayload(payload)) continue;
    if (payload.type !== "file" || !payload.file) continue;
    const proxied = await cacheImage(payload.file.url);
    if (proxied === payload.file.url) return block;
    return {
      ...block,
      [key]: {
        ...payload,
        file: { ...payload.file, url: proxied },
      },
    } as NotionBlock;
  }
  return block;
}

function isFilePayload(value: unknown): value is FilePayload {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown };
  return v.type === "file" || v.type === "external";
}
