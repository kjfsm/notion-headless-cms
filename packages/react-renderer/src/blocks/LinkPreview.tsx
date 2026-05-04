"use client";

import type { LinkPreviewBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Link as LinkIcon } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import type { BlockComponentProps } from "../types";

export function LinkPreview({
  block,
}: BlockComponentProps<LinkPreviewBlockObjectResponse>) {
  return (
    <a
      href={block.link_preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-3 block"
    >
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex items-center gap-2 p-3 text-sm">
          <LinkIcon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{block.link_preview.url}</span>
        </CardContent>
      </Card>
    </a>
  );
}
