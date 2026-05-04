"use client";

import type { ImageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { getFileUrl } from "../lib/notion-file";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

export function Image({
  block,
}: BlockComponentProps<ImageBlockObjectResponse>) {
  return (
    <figure className="my-4">
      <img
        src={getFileUrl(block.image)}
        alt={block.image.caption.map((rt) => rt.plain_text).join("") || ""}
        loading="lazy"
        className="h-auto max-w-full rounded-lg"
      />
      <Caption value={block.image.caption} />
    </figure>
  );
}
