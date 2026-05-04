"use client";

import type { AudioBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

function fileUrl(file: AudioBlockObjectResponse["audio"]): string {
  return file.type === "external" ? file.external.url : file.file.url;
}

export function Audio({
  block,
}: BlockComponentProps<AudioBlockObjectResponse>) {
  return (
    <figure className="my-4">
      {/* biome-ignore lint/a11y/useMediaCaption: Notion 側にキャプショントラックの概念がない */}
      <audio src={fileUrl(block.audio)} controls className="w-full" />
      {block.audio.caption.length > 0 ? (
        <figcaption className="mt-1 text-sm text-muted-foreground">
          <RichText value={block.audio.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}
