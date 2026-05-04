"use client";

import type { BookmarkBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Card, CardContent } from "../components/ui/card";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function Bookmark({
  block,
}: BlockComponentProps<BookmarkBlockObjectResponse>) {
  const url = block.bookmark.url;
  return (
    <div className="my-3">
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <Card className="transition-colors hover:bg-muted/40">
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="font-medium">{hostname(url)}</div>
            <div className="truncate text-xs text-muted-foreground">{url}</div>
          </CardContent>
        </Card>
      </a>
      {block.bookmark.caption.length > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          <RichText value={block.bookmark.caption} />
        </p>
      ) : null}
    </div>
  );
}
