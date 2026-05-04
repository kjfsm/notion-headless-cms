"use client";

import { AspectRatio } from "../components/ui/aspect-ratio";

export interface GenericIframeEmbedProps {
  url: string;
}

// マッチ漏れの URL は安全側に倒して標準サイズの iframe で表示する。
export function GenericIframeEmbed({ url }: GenericIframeEmbedProps) {
  return (
    <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg border">
      <iframe
        src={url}
        title="Embed"
        className="h-full w-full"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </AspectRatio>
  );
}
