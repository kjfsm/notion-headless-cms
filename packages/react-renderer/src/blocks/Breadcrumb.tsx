"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

// Notion API は breadcrumb で実際のパスを返さないため、最低限のプレースホルダ表示にとどめる。
export function Breadcrumb({
  className,
}: Pick<BlockComponentProps, "className"> = {}) {
  return (
    <nav
      aria-label="breadcrumb"
      className={cn("my-2 text-sm text-muted-foreground", className)}
    >
      <span>…</span>
      <ChevronRight
        className="mx-1 inline-block size-3 align-middle"
        aria-hidden
      />
      <span>page</span>
    </nav>
  );
}
