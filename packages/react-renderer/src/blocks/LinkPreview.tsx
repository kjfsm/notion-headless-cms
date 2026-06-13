"use client";

import type { LinkPreviewBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Link as LinkIcon } from "lucide-react";
import type { ElementType } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../components/ui/hover-card.js";
import { useNotionContext } from "../context";
import { OgCard, type OgCardData } from "../embeds/OgCard";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

type LinkPreviewBlockMaybeWithOgp = LinkPreviewBlockObjectResponse & {
  ogp?: OgCardData;
};

export function LinkPreview({
  block,
  className,
}: BlockComponentProps<LinkPreviewBlockObjectResponse>) {
  const { Link: LinkSlot } = useNotionContext();
  const url = block.link_preview.url;
  const ogp = (block as LinkPreviewBlockMaybeWithOgp).ogp;

  if (ogp) {
    return (
      <div className={cn("my-3", className)}>
        <OgCard url={url} ogp={ogp} />
      </div>
    );
  }

  const LinkComp = (LinkSlot ?? "a") as ElementType<
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  >;
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <LinkComp
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "my-2 inline-flex items-center gap-1 text-primary hover:underline",
            className,
          )}
        >
          <LinkIcon className="size-3.5" aria-hidden />
          <span className="truncate">{url}</span>
        </LinkComp>
      </HoverCardTrigger>
      <HoverCardContent className="text-xs break-all">{url}</HoverCardContent>
    </HoverCard>
  );
}
