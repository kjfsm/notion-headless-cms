"use client";

import type { ImageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { ElementType } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog.js";
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
  const alt = block.image.caption.map((rt) => rt.plain_text).join("") || "";
  const Img = (ImageSlot ?? "img") as ElementType<
    React.ImgHTMLAttributes<HTMLImageElement>
  >;

  return (
    <figure className={className}>
      <Dialog>
        <DialogTrigger
          className="block cursor-zoom-in border-0 bg-transparent p-0"
          aria-label="画像を拡大表示"
        >
          <Img
            src={src}
            alt={alt}
            loading="lazy"
            className="h-auto max-w-full rounded-lg"
          />
        </DialogTrigger>
        <DialogContent
          showCloseButton={false}
          className="max-w-[calc(100%-2rem)] border-0 bg-transparent p-0 shadow-none sm:max-w-[90vw]"
        >
          <DialogTitle className="sr-only">{alt || "画像"}</DialogTitle>
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-full object-contain"
          />
        </DialogContent>
      </Dialog>
      <Caption value={block.image.caption} />
    </figure>
  );
}
