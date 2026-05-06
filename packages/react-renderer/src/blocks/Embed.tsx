"use client";

import type { EmbedBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

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
}: BlockComponentProps<EmbedBlockObjectResponse>) {
  const url = block.embed.url;
  const size = resolveEmbedSize(url);

  return (
    <figure>
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
