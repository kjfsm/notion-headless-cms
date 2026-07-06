"use client";

import {
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Breadcrumb as UiBreadcrumb,
} from "../components/ui/breadcrumb.js";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

// Notion API は breadcrumb で実際のパスを返さないため、最低限のプレースホルダ表示にとどめる。
export function Breadcrumb({ className }: Pick<BlockComponentProps, "className"> = {}) {
  return (
    <UiBreadcrumb className={cn("my-2", className)}>
      <BreadcrumbList>
        <BreadcrumbItem>…</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>page</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </UiBreadcrumb>
  );
}
