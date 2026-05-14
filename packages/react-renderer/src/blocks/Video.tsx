"use client";

import type { VideoBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { AspectRatio } from "../components/ui/aspect-ratio";
import { useNotionContext } from "../context";
import { getFileUrl } from "../lib/notion-file";
import { cn } from "../lib/utils";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/** YouTube の watch URL を embed URL（?rel=0 付き）に変換する。既に embed 形式か非 YouTube URL はそのまま返す。 */
function toYoutubeEmbedUrl(url: string): string {
  const m = url.match(YOUTUBE_RE);
  if (m?.[1]) {
    return `https://www.youtube.com/embed/${m[1]}?rel=0`;
  }
  return url;
}

const NOTION_SANDBOX =
  "allow-scripts allow-popups allow-top-navigation-by-user-activation allow-forms allow-same-origin allow-storage-access-by-user-activation allow-popups-to-escape-sandbox";

export function Video({
  block,
  className,
}: BlockComponentProps<VideoBlockObjectResponse>) {
  const { resolveImageUrl } = useNotionContext();
  const rawUrl = getFileUrl(block.video);
  const resolved = resolveImageUrl ? resolveImageUrl(rawUrl, block) : rawUrl;
  const src =
    block.video.type === "external" ? toYoutubeEmbedUrl(resolved) : resolved;
  const caption = <Caption value={block.video.caption} />;

  if (block.video.type === "external") {
    return (
      <figure className={cn("my-4", className)}>
        <AspectRatio
          ratio={16 / 9}
          className="overflow-hidden rounded-lg border"
        >
          <iframe
            src={src}
            title="Video"
            className="h-full w-full"
            sandbox={NOTION_SANDBOX}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </AspectRatio>
        {caption}
      </figure>
    );
  }

  return (
    <figure className={cn("my-4", className)}>
      <video src={src} controls className="w-full rounded-lg">
        <track kind="captions" />
      </video>
      {caption}
    </figure>
  );
}
