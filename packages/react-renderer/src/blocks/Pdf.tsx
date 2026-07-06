"use client";

import type { PdfBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { EmbedFallback } from "../components/embed-fallback.js";
import { AspectRatio } from "../components/ui/aspect-ratio";
import { useNotionContext } from "../context";
import { getFileUrl } from "../lib/notion-file";
import { safeIframeSrc } from "../lib/safe-url.js";
import { cn } from "../lib/utils";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

export function Pdf({ block, className }: BlockComponentProps<PdfBlockObjectResponse>) {
  const { resolveImageUrl } = useNotionContext();
  const rawUrl = getFileUrl(block.pdf);
  const resolved = resolveImageUrl ? resolveImageUrl(rawUrl, block) : rawUrl;
  const caption = <Caption value={block.pdf.caption} />;

  // 危険なスキームは iframe に載せず、リンクにフォールバックする。
  const src = safeIframeSrc(resolved);
  if (!src) {
    return <EmbedFallback url={rawUrl} caption={caption} className={className} />;
  }

  return (
    <figure className={cn("my-4", className)}>
      <AspectRatio ratio={4 / 3} className="overflow-hidden rounded-lg border">
        <iframe
          src={src}
          title="PDF preview"
          className="h-full w-full"
          sandbox="allow-scripts allow-same-origin"
        />
      </AspectRatio>
      {caption}
    </figure>
  );
}
