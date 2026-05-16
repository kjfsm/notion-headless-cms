"use client";

import type { ElementType } from "react";
import { ScrollArea } from "../components/ui/scroll-area.js";
import { useNotionContext } from "../context.js";
import { cn } from "../lib/utils.js";
import type { BlockComponentProps } from "../types.js";

// heading レベル 1..4 を視覚的にインデントするためのクラス。
const INDENT_BY_LEVEL: Record<1 | 2 | 3 | 4, string> = {
  1: "pl-0",
  2: "pl-4",
  3: "pl-8",
  4: "pl-12",
};

/**
 * ページ内の heading_1..4 をリンクリストとして描画する。
 * 見出しは NotionRenderer が抽出して Context に流すため、ここでは読み取るだけ。
 */
export function TableOfContents({
  className,
}: Pick<BlockComponentProps, "className"> = {}) {
  const { headings, Link: LinkSlot } = useNotionContext();
  const items = headings ?? [];
  if (items.length === 0) return null;
  const LinkComp = (LinkSlot ?? "a") as ElementType<
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  >;
  return (
    <ScrollArea
      aria-label="table of contents"
      className={cn("my-3 max-h-64 rounded-lg border p-3 text-sm", className)}
    >
      <ul className="space-y-1">
        {items.map((h) => (
          <li key={h.id} className={INDENT_BY_LEVEL[h.level]}>
            <LinkComp
              href={`#${h.id}`}
              className="block truncate text-muted-foreground hover:text-foreground hover:underline"
            >
              {h.text}
            </LinkComp>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
