import type { NormalizedBlock } from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";
import { walkBlocks } from "./blocks.js";

/** file 参照を持つブロック種別（image/video/audio/file/pdf）。 */
const FILE_BLOCK_TYPES = new Set(["image", "video", "audio", "file", "pdf"]);

export interface ImageRef {
  readonly blockId: string;
  readonly url: string;
  readonly hash: string;
}

/**
 * キャッシュキー算出元の URL を正規化する（v2 `imageCacheKeySource` を移植）。
 * Notion 署名付きホストに限り、再署名のたびに変わるクエリを落として安定化する。
 * 外部画像（Unsplash 等）は素通しする。
 */
export function imageCacheKeySource(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const host = parsed.hostname.toLowerCase();
  const isNotionSignedHost =
    (host.includes("prod-files-secure") && host.endsWith(".amazonaws.com")) ||
    host === "notion.so" ||
    host.endsWith(".notion.so") ||
    host.endsWith(".notionusercontent.com");
  if (!isNotionSignedHost) return url;
  return `${parsed.origin}${parsed.pathname}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fileUrlFromBlockData(data: JsonValue): string | null {
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
 * block tree から画像等の file 参照を抽出し、キャッシュハッシュを算出する。
 * 実 fetch は行わない（「取得すべき画像のリスト」を返すだけ — I/O は同期エンジン側の責務）。
 */
export async function extractImageRefs(
  blocks: readonly NormalizedBlock[],
): Promise<ImageRef[]> {
  const refs: { blockId: string; url: string }[] = [];
  walkBlocks(blocks, (block) => {
    if (!FILE_BLOCK_TYPES.has(block.type)) return;
    const url = fileUrlFromBlockData(block.data);
    if (url) refs.push({ blockId: block.id, url });
  });
  return Promise.all(
    refs.map(async (ref) => ({
      ...ref,
      hash: await sha256Hex(imageCacheKeySource(ref.url)),
    })),
  );
}

export interface ImageDimensions {
  readonly width: number | null;
  readonly height: number | null;
  readonly contentType: string | null;
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! << 24) |
    (bytes[offset + 1]! << 16) |
    (bytes[offset + 2]! << 8) |
    bytes[offset + 3]!
  );
}
function readUInt16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}
function readUInt16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}
function readUInt32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  );
}

function parsePng(bytes: Uint8Array): ImageDimensions | null {
  // 8 バイトシグネチャ + IHDR チャンク(4 バイト長 + "IHDR" + width(4) + height(4))。
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((b, i) => bytes[i] === b)) return null;
  if (bytes.length < 24) return null;
  return {
    width: readUInt32BE(bytes, 16),
    height: readUInt32BE(bytes, 20),
    contentType: "image/png",
  };
}

function parseGif(bytes: Uint8Array): ImageDimensions | null {
  const isGif87 = String.fromCharCode(...bytes.slice(0, 6)) === "GIF87a";
  const isGif89 = String.fromCharCode(...bytes.slice(0, 6)) === "GIF89a";
  if (!isGif87 && !isGif89) return null;
  if (bytes.length < 10) return null;
  return {
    width: readUInt16LE(bytes, 6),
    height: readUInt16LE(bytes, 8),
    contentType: "image/gif",
  };
}

function parseJpeg(bytes: Uint8Array): ImageDimensions | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1]!;
    // SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15 (SOF マーカー群。SOF4/8/12 は除く)。
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    const segmentLength = readUInt16BE(bytes, offset + 2);
    if (isSof) {
      const height = readUInt16BE(bytes, offset + 5);
      const width = readUInt16BE(bytes, offset + 7);
      return { width, height, contentType: "image/jpeg" };
    }
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd9)
    ) {
      offset += 2;
      continue;
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function parseWebp(bytes: Uint8Array): ImageDimensions | null {
  if (String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF") return null;
  if (String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP") return null;
  const chunkType = String.fromCharCode(...bytes.slice(12, 16));
  if (chunkType === "VP8 ") {
    // Lossy: フレームタグの後、17〜18 バイト目付近に 14bit width/height(下位2bitはスケール)。
    const width = readUInt16LE(bytes, 26) & 0x3fff;
    const height = readUInt16LE(bytes, 28) & 0x3fff;
    return { width, height, contentType: "image/webp" };
  }
  if (chunkType === "VP8L") {
    const b = readUInt32LE(bytes, 21);
    const width = (b & 0x3fff) + 1;
    const height = ((b >> 14) & 0x3fff) + 1;
    return { width, height, contentType: "image/webp" };
  }
  if (chunkType === "VP8X") {
    const width = (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)) + 1;
    const height = (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) + 1;
    return { width, height, contentType: "image/webp" };
  }
  return null;
}

/**
 * JPEG/PNG/WebP/GIF の先頭バイトから寸法を読む軽量パーサ。
 * variant 生成はしない（#437 ADR-7）— CLS ゼロ化のための width/height 取得のみ。
 */
export function parseImageDimensions(bytes: Uint8Array): ImageDimensions {
  const parsers = [parsePng, parseGif, parseJpeg, parseWebp];
  for (const parser of parsers) {
    const result = parser(bytes);
    if (result) return result;
  }
  return { width: null, height: null, contentType: null };
}
