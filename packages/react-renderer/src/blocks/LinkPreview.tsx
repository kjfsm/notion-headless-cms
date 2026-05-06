"use client";

import type { LinkPreviewBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Link as LinkIcon } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { OgCard, type OgCardData } from "../embeds/OgCard";
import type { BlockComponentProps } from "../types";

type LinkPreviewBlockMaybeWithOgp = LinkPreviewBlockObjectResponse & {
  ogp?: OgCardData;
};

export function LinkPreview({
  block,
}: BlockComponentProps<LinkPreviewBlockObjectResponse>) {
  const url = block.link_preview.url;
  const ogp = (block as LinkPreviewBlockMaybeWithOgp).ogp;

  if (ogp) {
    return (
      <div className="my-3">
        <OgCard url={url} ogp={ogp} />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-3 block"
    >
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex items-center gap-2 p-3 text-sm">
          <LinkIcon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{url}</span>
        </CardContent>
      </Card>
    </a>
  );
}
