"use client";

import type { PdfBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { AspectRatio } from "../components/ui/aspect-ratio";
import { getFileUrl } from "../lib/notion-file";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

export function Pdf({ block }: BlockComponentProps<PdfBlockObjectResponse>) {
  return (
    <figure className="my-4">
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
