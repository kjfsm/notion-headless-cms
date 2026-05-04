"use client";

import { AspectRatio } from "../components/ui/aspect-ratio";
import { extractVimeoId } from "../lib/url-matchers";

export interface VimeoEmbedProps {
  url: string;
}

export function VimeoEmbed({ url }: VimeoEmbedProps) {
  const id = extractVimeoId(url);
  const src = id ? `https://player.vimeo.com/video/${id}` : url;
  return (
    <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg border">
      <iframe
        src={src}
        title="Vimeo"
        className="h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        allowFullScreen
      />
    </AspectRatio>
  );
}
