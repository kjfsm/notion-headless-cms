"use client";

import type { PdfBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { AspectRatio } from "../components/ui/aspect-ratio";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

function fileUrl(file: PdfBlockObjectResponse["pdf"]): string {
  return file.type === "external" ? file.external.url : file.file.url;
}

export function Pdf({ block }: BlockComponentProps<PdfBlockObjectResponse>) {
  return (
    <figure className="my-4">
      <AspectRatio ratio={4 / 3} className="overflow-hidden rounded-lg border">
        <iframe
          src={fileUrl(block.pdf)}
          title="PDF preview"
          className="h-full w-full"
        />
      </AspectRatio>
      {block.pdf.caption.length > 0 ? (
        <figcaption className="mt-1 text-center text-sm text-muted-foreground">
          <RichText value={block.pdf.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}
