"use client";

import { useEffect, useRef } from "react";
import { useExternalScript } from "../hooks/useExternalScript";

export interface TwitterEmbedProps {
  url: string;
}

const TWITTER_WIDGET = "https://platform.twitter.com/widgets.js";

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load?: (target?: HTMLElement | null) => void;
      };
    };
  }
}

/**
 * blockquote 形式の Twitter/X 埋め込み。
 * widgets.js を 1 度だけ動的ロードし、ロード後に widgets.load() でハイドレーションする。
 */
export function TwitterEmbed({ url }: TwitterEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const status = useExternalScript(TWITTER_WIDGET);

  useEffect(() => {
    if (status !== "loaded") return;
    window.twttr?.widgets?.load?.(ref.current);
  }, [status]);

  return (
    <div ref={ref} className="my-2 flex justify-center">
      <blockquote className="twitter-tweet">
        <a href={url}>{url}</a>
      </blockquote>
    </div>
  );
}
