"use client";

import type { VideoBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { YouTubeEmbed } from "../embeds/YouTubeEmbed";
import { getFileUrl } from "../lib/notion-file";
import { isYouTubeUrl } from "../lib/url-matchers";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

export function Video({
  block,
}: BlockComponentProps<VideoBlockObjectResponse>) {
  const src = getFileUrl(block.video);
  const caption = <Caption value={block.video.caption} />;

  if (isYouTubeUrl(src)) {
    return (
      <figure className="my-4">
        <YouTubeEmbed url={src} />
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
