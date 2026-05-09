"use client";

import type { AudioBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { useNotionContext } from "../context";
import { getFileUrl } from "../lib/notion-file";
import { cn } from "../lib/utils";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

export function Audio({
  block,
  className,
}: BlockComponentProps<AudioBlockObjectResponse>) {
  const { resolveImageUrl } = useNotionContext();
  const rawUrl = getFileUrl(block.audio);
  const src = resolveImageUrl ? resolveImageUrl(rawUrl, block) : rawUrl;
  return (
    <figure className={cn("my-4", className)}>
      {/* biome-ignore lint/a11y/useMediaCaption: Notion 側にキャプショントラックの概念がない */}
      <audio src={src} controls className="w-full" />
      <Caption value={block.audio.caption} variant="block" />
    </figure>
  );
}
