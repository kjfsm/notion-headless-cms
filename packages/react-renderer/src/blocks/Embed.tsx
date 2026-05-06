"use client";

import type { EmbedBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { AspectRatio } from "../components/ui/aspect-ratio";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

export function Embed({
  block,
}: BlockComponentProps<EmbedBlockObjectResponse>) {
  const url = block.embed.url;

  return (
    <figure className="my-4">
      <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg border">
        <iframe
          src={url}
          title="Embed"
          className="h-full w-full"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </AspectRatio>
      <Caption value={block.embed.caption} />
    </figure>
  );
}
