"use client";

import type { ElementType } from "react";
import { useNotionContext } from "../context.js";
import { cn } from "../lib/utils.js";
import type { BlockComponentProps } from "../types.js";

const INDENT_BY_LEVEL: Record<1 | 2 | 3 | 4, string> = {
  1: "pl-0",
  2: "pl-4",
  3: "pl-8",
  4: "pl-12",
};

/**
 * ページ内の heading_1..4 をリンクリストとして描画する。
 * 見出しは NotionRenderer が抽出して Context に流すため、ここでは読み取るだけ。
 *
 * ScrollArea を使わずに `overflow-y-auto` 直書きにしているのは、Radix の
 * 内部ラッパが `display:table` を被せるため `truncate` が機能しなくなり、
 * 長い見出しテキストが横に溢れて視覚的に重なるのを避けるため。
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
    <nav
      aria-label="table of contents"
      className={cn(
        "my-3 max-h-64 w-full overflow-y-auto rounded-lg border p-3 text-sm",
        className,
      )}
    >
      <ul className="space-y-1">
        {items.map((h) => (
          <li key={h.id} className={cn("min-w-0", INDENT_BY_LEVEL[h.level])}>
            <LinkComp
              href={`#${h.id}`}
              className="block truncate text-muted-foreground hover:text-foreground hover:underline"
            >
              {h.text}
            </LinkComp>
          </li>
        ))}
      </ul>
    </nav>
  );
}
