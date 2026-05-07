"use client";

import type { BookmarkBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { OgCard, type OgCardData } from "../embeds/OgCard";
import { cn } from "../lib/utils";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

type BookmarkBlockMaybeWithOgp = BookmarkBlockObjectResponse & {
  ogp?: OgCardData;
};

export function Bookmark({
  block,
  className,
}: BlockComponentProps<BookmarkBlockObjectResponse>) {
  const url = block.bookmark.url;
  const ogp = (block as BookmarkBlockMaybeWithOgp).ogp;
  return (
    <div className={cn("my-3", className)}>
      <OgCard url={url} ogp={ogp} />
      <Caption value={block.bookmark.caption} variant="block" />
    </div>
  );
}
