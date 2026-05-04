"use client";

import type { VideoBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { VimeoEmbed } from "../embeds/VimeoEmbed";
import { YouTubeEmbed } from "../embeds/YouTubeEmbed";
import { getFileUrl } from "../lib/notion-file";
import { detectEmbedKind } from "../lib/url-matchers";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

export function Video({
  block,
}: BlockComponentProps<VideoBlockObjectResponse>) {
  const src = getFileUrl(block.video);
  const kind = detectEmbedKind(src);
  const caption = <Caption value={block.video.caption} />;

  if (kind === "youtube") {
    return (
      <figure className="my-4">
        <YouTubeEmbed url={src} />
        {caption}
      </figure>
    );
  }
  if (kind === "vimeo") {
    return (
      <figure className="my-4">
        <VimeoEmbed url={src} />
        {caption}
      </figure>
    );
  }

  return (
    <figure className="my-4">
      <video src={src} controls className="w-full rounded-lg">
        <track kind="captions" />
      </video>
      {caption}
    </figure>
  );
}
