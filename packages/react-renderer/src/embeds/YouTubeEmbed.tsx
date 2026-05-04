"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { AspectRatio } from "../components/ui/aspect-ratio";
import { extractYouTubeId } from "../lib/url-matchers";

export interface YouTubeEmbedProps {
  url: string;
}

/**
 * facade パターンの YouTube 埋め込み。
 * 初期はサムネイル画像のみ描画し、クリック時に iframe をマウントする (Lighthouse 改善)。
 */
export function YouTubeEmbed({ url }: YouTubeEmbedProps) {
  const id = extractYouTubeId(url);
  const [active, setActive] = useState(false);

  if (!id) {
    return (
      <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg border">
        <iframe
          src={url}
          title="YouTube"
          className="h-full w-full"
          allowFullScreen
        />
      </AspectRatio>
    );
  }

  if (active) {
    return (
      <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg border">
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1`}
          title="YouTube"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </AspectRatio>
    );
  }

  return (
    <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => setActive(true)}
        className="group relative h-full w-full"
        aria-label="Play video"
      >
        <img
          src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/40">
          <span className="rounded-full bg-white/90 p-3">
            <Play className="size-6 text-black" aria-hidden />
          </span>
        </span>
      </button>
    </AspectRatio>
  );
}
