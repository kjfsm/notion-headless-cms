"use client";

import { ChevronRight } from "lucide-react";

// Notion API は breadcrumb で実際のパスを返さないため、最低限のプレースホルダ表示にとどめる。
export function Breadcrumb() {
  return (
    <nav aria-label="breadcrumb" className="my-2 text-sm text-muted-foreground">
      <span>…</span>
      <ChevronRight
        className="mx-1 inline-block size-3 align-middle"
        aria-hidden
      />
      <span>page</span>
    </nav>
  );
}
