"use client";

import type { ChildPageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { FileText } from "lucide-react";
import type { ElementType } from "react";
import { useNotionContext } from "../context";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

export function ChildPage({
  block,
  className,
}: BlockComponentProps<ChildPageBlockObjectResponse>) {
  const { resolvePageUrl, Link: LinkSlot } = useNotionContext();
  const href = resolvePageUrl ? resolvePageUrl(block.id) : undefined;

  if (href) {
    const LinkComp = (LinkSlot ?? "a") as ElementType<
      React.AnchorHTMLAttributes<HTMLAnchorElement>
    >;
    return (
      <LinkComp
        href={href}
        className={cn("my-2 flex items-baseline gap-2", className)}
      >
        <FileText
          className="size-4 self-center text-muted-foreground"
          aria-hidden
        />
        <span>{block.child_page.title}</span>
      </LinkComp>
    );
  }

  return (
    <div className={cn("my-2 flex items-baseline gap-2", className)}>
      <FileText
        className="size-4 self-center text-muted-foreground"
        aria-hidden
      />
      <span>{block.child_page.title}</span>
    </div>
  );
}
