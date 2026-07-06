"use client";

import type { BookmarkBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { OgCard, type OgCardData } from "../embeds/OgCard";
import { useOgp } from "../embeds/useOgp.js";
import { cn } from "../lib/utils";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

type BookmarkBlockMaybeWithOgp = BookmarkBlockObjectResponse & {
  ogp?: OgCardData;
};

/**
 * bookmark ブロックの既定描画。`block.ogp`（同期時に付与済みの OGP メタデータ）が
 * あればそれを最優先で使う。無ければ `useOgp` がページアクセス時にクライアントから
 * `ogpEndpoint` を叩いて取得する（それも無ければシェルのリンクカードのまま）。
 */
export function Bookmark({ block, className }: BlockComponentProps<BookmarkBlockObjectResponse>) {
  const url = block.bookmark.url;
  const preloadedOgp = (block as BookmarkBlockMaybeWithOgp).ogp;
  const fetchedOgp = useOgp(preloadedOgp ? null : url);
  const ogp = preloadedOgp ?? fetchedOgp;
  return (
    <div className={cn("my-3", className)}>
      <OgCard url={url} ogp={ogp} />
      <Caption value={block.bookmark.caption} variant="block" />
    </div>
  );
}
