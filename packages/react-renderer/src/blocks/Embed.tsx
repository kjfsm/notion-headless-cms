"use client";

import type { EmbedBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/** YouTube の watch URL を embed URL（?rel=0 付き）に変換する。非 YouTube URL はそのまま返す。 */
function toYoutubeEmbedUrl(url: string): string {
  const m = url.match(YOUTUBE_RE);
  if (m?.[1]) {
    return `https://www.youtube.com/embed/${m[1]}?rel=0`;
  }
  return url;
}

const NOTION_SANDBOX =
  "allow-scripts allow-popups allow-top-navigation-by-user-activation allow-forms allow-same-origin allow-storage-access-by-user-activation allow-popups-to-escape-sandbox";

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
  const url = toYoutubeEmbedUrl(block.embed.url);
  const size = resolveEmbedSize(url);

  return (
    <figure className={className}>
      <iframe
        src={url}
        title="Embed"
        width={size.width}
        height={size.height}
        className={size.aspectVideo ? "aspect-video w-full" : "max-w-full"}
        sandbox={NOTION_SANDBOX}
        allowFullScreen
        loading="lazy"
      />
      <Caption value={block.embed.caption} />
    </figure>
  );
}
