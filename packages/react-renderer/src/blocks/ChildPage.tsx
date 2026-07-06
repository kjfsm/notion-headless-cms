"use client";

import type { ChildPageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { FileText } from "lucide-react";
import type { ElementType } from "react";

import { Card, CardHeader, CardTitle } from "../components/ui/card.js";
import { useNotionContext } from "../context";
import { normalizePageId } from "../lib/normalize-page-id.js";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

export function ChildPage({ block, className }: BlockComponentProps<ChildPageBlockObjectResponse>) {
  const { pageLinks, resolvePageUrl, Link: LinkSlot } = useNotionContext();
  // child_page の id はその子ページ自身の pageId。pageLinks → 関数の順で解決。
  const href = pageLinks?.[normalizePageId(block.id)]?.href ?? resolvePageUrl?.(block.id);

  const inner = (
    <CardHeader className="flex flex-row items-center gap-2">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <CardTitle className="text-base">{block.child_page.title}</CardTitle>
    </CardHeader>
  );

  if (href) {
    const LinkComp = (LinkSlot ?? "a") as ElementType<
      React.AnchorHTMLAttributes<HTMLAnchorElement>
    >;
    return (
      <LinkComp href={href} className={cn("my-2 block no-underline", className)}>
        <Card className="py-3 transition-colors hover:bg-muted/40">{inner}</Card>
      </LinkComp>
    );
  }

  return <Card className={cn("my-2 py-3", className)}>{inner}</Card>;
}
