"use client";

import type { LinkToPageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { FileText } from "lucide-react";
import type { ElementType } from "react";

import { Button } from "../components/ui/button.js";
import { useNotionContext } from "../context.js";
import { normalizePageId } from "../lib/normalize-page-id.js";
import { cn } from "../lib/utils.js";
import type { BlockComponentProps } from "../types.js";

export function LinkToPage({
  block,
  className,
}: BlockComponentProps<LinkToPageBlockObjectResponse>) {
  const { pageLinks, resolvePageUrl, resolvePageTitle, Link: LinkSlot } = useNotionContext();
  const target = block.link_to_page;
  const id =
    target.type === "page_id"
      ? target.page_id
      : target.type === "database_id"
        ? target.database_id
        : "comment";
  const resolved = pageLinks?.[normalizePageId(id)];
  const href = resolved?.href ?? resolvePageUrl?.(id) ?? `#${id}`;
  const title = resolved?.title || resolvePageTitle?.(id) || "Open page";
  const LinkComp = (LinkSlot ?? "a") as ElementType<React.AnchorHTMLAttributes<HTMLAnchorElement>>;
  return (
    <Button asChild variant="link" size="sm" className={cn("my-2 px-0", className)}>
      <LinkComp href={href}>
        <FileText aria-hidden />
        {title}
      </LinkComp>
    </Button>
  );
}
