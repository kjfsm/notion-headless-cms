"use client";

import type { EmbedBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { ReactNode } from "react";
import { DlsiteEmbed } from "../embeds/DlsiteEmbed";
import { GenericIframeEmbed } from "../embeds/GenericIframeEmbed";
import { SteamEmbed } from "../embeds/SteamEmbed";
import { TwitterEmbed } from "../embeds/TwitterEmbed";
import { VimeoEmbed } from "../embeds/VimeoEmbed";
import { YouTubeEmbed } from "../embeds/YouTubeEmbed";
import { detectEmbedKind } from "../lib/url-matchers";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

export function Embed({
  block,
}: BlockComponentProps<EmbedBlockObjectResponse>) {
  const url = block.embed.url;
  const kind = detectEmbedKind(url);
  const caption = block.embed.caption;

  let inner: ReactNode;
  switch (kind) {
    case "youtube":
      inner = <YouTubeEmbed url={url} />;
      break;
    case "vimeo":
      inner = <VimeoEmbed url={url} />;
      break;
    case "twitter":
      inner = <TwitterEmbed url={url} />;
      break;
    case "dlsite":
      inner = <DlsiteEmbed url={url} />;
      break;
    case "steam":
      inner = <SteamEmbed url={url} />;
      break;
    default:
      inner = <GenericIframeEmbed url={url} />;
  }

  return (
    <figure className="my-4">
      {inner}
      {caption.length > 0 ? (
        <figcaption className="mt-1 text-center text-sm text-muted-foreground">
          <RichText value={caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}
