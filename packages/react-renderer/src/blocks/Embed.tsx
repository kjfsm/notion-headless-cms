"use client";

import type { EmbedBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/** YouTube の watch URL を embed URL に変換する。非 YouTube URL はそのまま返す。 */
function toEmbedUrl(url: string): string {
  const m = url.match(YOUTUBE_RE);
  if (m?.[1]) {
    return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  }
  return url;
}

/**
 * 埋め込み URL ごとの推奨サイズ。クロスオリジン iframe は中身の実寸を取得できず
 * Notion API も寸法を返さないため、ホスト別のテンプレ値で近似する。
 */
function resolveEmbedSize(url: string): {
  width?: number;
  height?: number;
  aspectVideo?: boolean;
} {
  try {
    const { hostname, pathname } = new URL(url);
    if (
      hostname === "store.steampowered.com" &&
      pathname.startsWith("/widget/")
    ) {
      return { width: 646, height: 190 };
    }
  } catch {
    // URL parse 失敗時は既定にフォールバック
  }
  return { aspectVideo: true };
}

export function Embed({
  block,
  className,
}: BlockComponentProps<EmbedBlockObjectResponse>) {
  const url = toEmbedUrl(block.embed.url);
  const size = resolveEmbedSize(url);

  return (
    <figure className={className}>
      <iframe
        src={url}
        title="Embed"
        width={size.width}
        height={size.height}
        className={size.aspectVideo ? "aspect-video w-full" : "max-w-full"}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <Caption value={block.embed.caption} />
    </figure>
  );
}
