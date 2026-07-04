import type {
  ImageMapEntry,
  NormalizedBlock,
} from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";
import { imageCacheKeySource, sha256Hex } from "./images.js";

const FILE_BLOCK_TYPES = new Set(["image", "video", "audio", "file", "pdf"]);

function rewriteFileUrl(
  data: JsonValue,
  proxyUrl: string,
  dims: ImageMapEntry | undefined,
): JsonValue {
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return data;
  const record = { ...(data as Record<string, JsonValue>) };
  if (record.type === "file") {
    const file = record.file as Record<string, JsonValue> | undefined;
    record.file = { ...file, url: proxyUrl };
  } else if (record.type === "external") {
    const external = record.external as Record<string, JsonValue> | undefined;
    record.external = { ...external, url: proxyUrl };
  }
  if (dims) {
    // CLS ゼロ化のための寸法。react-renderer 等の消費側は任意で利用する(元の Notion API 形状には無いフィールド)。
    record._dimensions = { width: dims.width, height: dims.height };
  }
  return record;
}

function extractRawUrl(data: JsonValue): string | null {
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return null;
  const record = data as Record<string, JsonValue>;
  if (record.type === "file") {
    const file = record.file as Record<string, JsonValue> | undefined;
    return typeof file?.url === "string" ? file.url : null;
  }
  if (record.type === "external") {
    const external = record.external as Record<string, JsonValue> | undefined;
    return typeof external?.url === "string" ? external.url : null;
  }
  return null;
}

/**
 * block tree 内の file 参照(image/video/audio/file/pdf)の URL を、同期時に取得済みの
 * `images` マップを使って `{imagesPath}/{hash}` へ焼き込む(v2 `resolveBlockImageUrls` の
 * 同期時版。利用側の手動呼び出しを不要にする)。実 fetch は行わない純関数。
 */
export async function resolveImageUrls(
  blocks: readonly NormalizedBlock[],
  images: Readonly<Record<string, ImageMapEntry>>,
  imagesPath = "/images",
): Promise<NormalizedBlock[]> {
  async function resolveBlock(
    block: NormalizedBlock,
  ): Promise<NormalizedBlock> {
    const children = block.children
      ? await Promise.all(block.children.map(resolveBlock))
      : undefined;
    if (!FILE_BLOCK_TYPES.has(block.type)) {
      return children ? { ...block, children } : block;
    }
    const rawUrl = extractRawUrl(block.data);
    if (!rawUrl) return children ? { ...block, children } : block;
    const hash = await sha256Hex(imageCacheKeySource(rawUrl));
    const dims = images[hash];
    const proxyUrl = `${imagesPath}/${hash}`;
    return {
      ...block,
      data: rewriteFileUrl(
        block.data,
        proxyUrl,
        block.type === "image" ? dims : undefined,
      ),
      ...(children ? { children } : {}),
    };
  }
  return Promise.all(blocks.map(resolveBlock));
}
