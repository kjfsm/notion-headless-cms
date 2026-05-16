"use client";

import { ScrollArea } from "../components/ui/scroll-area.js";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

// table_of_contents 自体は children を持たないため、現在のページのヘディング情報が必要。
// 単独描画では情報が無いので、利用側で <NotionRenderer> ラッパに目次注入する想定の薄い実装にする。
export function TableOfContents({
  className,
}: Pick<BlockComponentProps, "className"> = {}) {
  return (
    <ScrollArea
      aria-label="table of contents"
      className={cn("my-3 max-h-64 rounded-lg border p-3 text-sm", className)}
    >
      <p className="text-muted-foreground">Table of contents</p>
    </ScrollArea>
  );
}
