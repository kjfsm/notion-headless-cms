"use client";

import type { VideoBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { AspectRatio } from "../components/ui/aspect-ratio";
import { getFileUrl } from "../lib/notion-file";
import { cn } from "../lib/utils";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

export function Video({
  block,
  className,
}: BlockComponentProps<VideoBlockObjectResponse>) {
  const src = getFileUrl(block.video);
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
            sandbox="allow-scripts allow-same-origin allow-popups"
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
