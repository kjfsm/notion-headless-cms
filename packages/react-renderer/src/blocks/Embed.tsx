"use client";

import type { EmbedBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { OgCard, type OgCardData } from "../embeds/OgCard";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

/** notion-orm が付与する `ogp` フィールドを参照するための拡張型。 */
type EmbedBlockMaybeWithOgp = EmbedBlockObjectResponse & {
  embed: EmbedBlockObjectResponse["embed"];
  ogp?: OgCardData;
};

export function Embed({
  block,
}: BlockComponentProps<EmbedBlockObjectResponse>) {
  const url = block.embed.url;
  const ogp = (block as EmbedBlockMaybeWithOgp).ogp;

  return (
    <figure className="my-4">
      <OgCard url={url} ogp={ogp} />
      <Caption value={block.embed.caption} />
    </figure>
  );
}
