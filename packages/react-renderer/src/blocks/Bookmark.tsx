"use client";

import type { BookmarkBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { OgCard, type OgCardData } from "../embeds/OgCard";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

type BookmarkBlockMaybeWithOgp = BookmarkBlockObjectResponse & {
  ogp?: OgCardData;
};

export function Bookmark({
  block,
}: BlockComponentProps<BookmarkBlockObjectResponse>) {
  const url = block.bookmark.url;
  const ogp = (block as BookmarkBlockMaybeWithOgp).ogp;
  return (
    <div className="my-3">
      <OgCard url={url} ogp={ogp} />
      <Caption value={block.bookmark.caption} variant="block" />
    </div>
  );
}
