"use client";

import type { LinkPreviewBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Link as LinkIcon } from "lucide-react";
import type { ElementType } from "react";
import { Card, CardContent } from "../components/ui/card";
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
    <LinkComp
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("my-3 block", className)}
    >
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex items-center gap-2 p-3 text-sm">
          <LinkIcon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{url}</span>
        </CardContent>
      </Card>
    </LinkComp>
  );
}
