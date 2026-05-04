"use client";

import type { ImageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

function fileUrl(file: ImageBlockObjectResponse["image"]): string {
  return file.type === "external" ? file.external.url : file.file.url;
}

export function Image({
  block,
}: BlockComponentProps<ImageBlockObjectResponse>) {
  const src = fileUrl(block.image);
  return (
    <figure className="my-4">
      <img
        src={src}
        alt={block.image.caption.map((rt) => rt.plain_text).join("") || ""}
        loading="lazy"
        className="h-auto max-w-full rounded-lg"
      />
      {block.image.caption.length > 0 ? (
        <figcaption className="mt-1 text-center text-sm text-muted-foreground">
          <RichText value={block.image.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}
