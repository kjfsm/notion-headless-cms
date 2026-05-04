"use client";

import type { AudioBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { getFileUrl } from "../lib/notion-file";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

export function Audio({
  block,
}: BlockComponentProps<AudioBlockObjectResponse>) {
  return (
    <figure className="my-4">
      {/* biome-ignore lint/a11y/useMediaCaption: Notion 側にキャプショントラックの概念がない */}
      <audio src={getFileUrl(block.audio)} controls className="w-full" />
      <Caption value={block.audio.caption} variant="block" />
    </figure>
  );
}
