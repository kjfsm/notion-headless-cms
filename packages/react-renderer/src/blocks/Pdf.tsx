"use client";

import type { PdfBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { AspectRatio } from "../components/ui/aspect-ratio";
import { getFileUrl } from "../lib/notion-file";
import { cn } from "../lib/utils";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

export function Pdf({
  block,
  className,
}: BlockComponentProps<PdfBlockObjectResponse>) {
  return (
    <figure className={cn("my-4", className)}>
      <AspectRatio ratio={4 / 3} className="overflow-hidden rounded-lg border">
        <iframe
          src={getFileUrl(block.pdf)}
          title="PDF preview"
          className="h-full w-full"
          sandbox="allow-scripts allow-same-origin"
        />
      </AspectRatio>
      <Caption value={block.pdf.caption} />
    </figure>
  );
}
