"use client";

import type { LinkToPageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { ExternalLink } from "lucide-react";
import type { ElementType } from "react";
import { useNotionContext } from "../context";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

export function LinkToPage({
  block,
  className,
}: BlockComponentProps<LinkToPageBlockObjectResponse>) {
  const { resolvePageUrl, Link: LinkSlot } = useNotionContext();
  const target = block.link_to_page;
  // Notion 内部リンクなのでルーティングは利用側に委ねる。最低限「リンクである」見た目で出力。
  const id =
    target.type === "page_id"
      ? target.page_id
      : target.type === "database_id"
        ? target.database_id
        : "comment";
  const href = resolvePageUrl ? resolvePageUrl(id) : `#${id}`;
  const LinkComp = (LinkSlot ?? "a") as ElementType<
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  >;
  return (
    <LinkComp
      href={href}
      className={cn(
        "my-2 inline-flex items-baseline gap-1 text-primary hover:underline",
        className,
      )}
    >
      <ExternalLink className="size-3.5 self-center" aria-hidden />
      {id}
    </LinkComp>
  );
}
