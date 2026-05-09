"use client";

import type { ImageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { ElementType } from "react";
import { useNotionContext } from "../context";
import { getFileUrl } from "../lib/notion-file";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

export function Image({
  block,
  className,
}: BlockComponentProps<ImageBlockObjectResponse>) {
  const { resolveImageUrl, Image: ImageSlot } = useNotionContext();
  const rawUrl = getFileUrl(block.image);
  const src = resolveImageUrl ? resolveImageUrl(rawUrl, block) : rawUrl;
  const Img = (ImageSlot ?? "img") as ElementType<
    React.ImgHTMLAttributes<HTMLImageElement>
  >;
  return (
    <figure className={className}>
      <Img
        src={src}
        alt={block.image.caption.map((rt) => rt.plain_text).join("") || ""}
        loading="lazy"
        className="h-auto max-w-full rounded-lg"
      />
      <Caption value={block.image.caption} />
    </figure>
  );
}
