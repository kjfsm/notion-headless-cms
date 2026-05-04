"use client";

import type { VideoBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { VimeoEmbed } from "../embeds/VimeoEmbed";
import { YouTubeEmbed } from "../embeds/YouTubeEmbed";
import { detectEmbedKind } from "../lib/url-matchers";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

function fileUrl(file: VideoBlockObjectResponse["video"]): string {
  return file.type === "external" ? file.external.url : file.file.url;
}

export function Video({
  block,
}: BlockComponentProps<VideoBlockObjectResponse>) {
  const src = fileUrl(block.video);
  const kind = detectEmbedKind(src);
  const caption = block.video.caption;
  const captionEl =
    caption.length > 0 ? (
      <figcaption className="mt-1 text-center text-sm text-muted-foreground">
        <RichText value={caption} />
      </figcaption>
    ) : null;

  if (kind === "youtube") {
    return (
      <figure className="my-4">
        <YouTubeEmbed url={src} />
        {captionEl}
      </figure>
    );
  }
  if (kind === "vimeo") {
    return (
      <figure className="my-4">
        <VimeoEmbed url={src} />
        {captionEl}
      </figure>
    );
  }

  return (
    <figure className="my-4">
      <video src={src} controls className="w-full rounded-lg">
        <track kind="captions" />
      </video>
      {captionEl}
    </figure>
  );
}
