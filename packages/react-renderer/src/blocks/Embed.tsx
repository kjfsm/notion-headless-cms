"use client";

import type { EmbedBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { EmbedFallback } from "../components/embed-fallback.js";
import { AspectRatio } from "../components/ui/aspect-ratio.js";
import { safeIframeSrc } from "../lib/safe-url.js";
import { cn } from "../lib/utils";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/** YouTube の watch URL を embed URL（?rel=0 付き）に変換する。非 YouTube URL はそのまま返す。 */
function toYoutubeEmbedUrl(url: string): string {
  const m = url.match(YOUTUBE_RE);
  if (m?.[1]) {
    return `https://www.youtube.com/embed/${m[1]}?rel=0`;
  }
  return url;
}

// sandbox は allow-same-origin を含む。これは YouTube/Vimeo/Steam 等の正当な
// third-party 埋め込みが自身のオリジンで cookie/localStorage を使うために必要で、
// 実際の XSS ベクトルである src スキーム(javascript:/data:)は safeIframeSrc で弾く。
const NOTION_SANDBOX =
  "allow-scripts allow-popups allow-top-navigation-by-user-activation allow-forms allow-same-origin allow-storage-access-by-user-activation allow-popups-to-escape-sandbox";

/**
 * 埋め込み URL ごとの推奨サイズ。クロスオリジン iframe は中身の実寸を取得できず
 * Notion API も寸法を返さないため、ホスト別のテンプレ値で近似する。
 */
function resolveEmbedSize(url: string): {
  width?: number;
  height?: number;
  ratio?: number;
} {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname === "store.steampowered.com" && pathname.startsWith("/widget/")) {
      // Steam ウィジェットは幅を指定すると埋め込み幅より狭くなるため、幅は全幅（w-full）に委ねる
      return { height: 190 };
    }
  } catch {
    // URL parse 失敗時は既定にフォールバック
  }
  return { ratio: 16 / 9 };
}

export function Embed({ block, className }: BlockComponentProps<EmbedBlockObjectResponse>) {
  const url = toYoutubeEmbedUrl(block.embed.url);
  const caption = <Caption value={block.embed.caption} />;

  // 危険なスキーム(javascript:/data: 等)は iframe に載せず、リンクにフォールバックする。
  const src = safeIframeSrc(url);
  if (!src) {
    return <EmbedFallback url={block.embed.url} caption={caption} className={className} />;
  }

  const size = resolveEmbedSize(url);

  if (size.ratio) {
    return (
      <figure className={cn("my-4", className)}>
        <AspectRatio ratio={size.ratio} className="overflow-hidden rounded-lg border">
          <iframe
            src={src}
            title="Embed"
            className="h-full w-full"
            sandbox={NOTION_SANDBOX}
            allowFullScreen
            loading="lazy"
          />
        </AspectRatio>
        {caption}
      </figure>
    );
  }

  return (
    <figure className={cn("my-4", className)}>
      <iframe
        src={src}
        title="Embed"
        width={size.width}
        height={size.height}
        className={cn("max-w-full", !size.width && "w-full")}
        sandbox={NOTION_SANDBOX}
        allowFullScreen
        loading="lazy"
      />
      {caption}
    </figure>
  );
}
