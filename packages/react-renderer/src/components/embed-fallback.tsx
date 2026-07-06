import type { ReactNode } from "react";

import { safeHref } from "../lib/safe-url.js";
import { cn } from "../lib/utils.js";

/**
 * iframe の `src` が安全でないスキーム(`javascript:`/`data:text/html` 等)だった場合の
 * フォールバック。iframe を描画せず、無害化したリンク + caption を表示する。
 * Embed/Pdf/Video が iframe を出せないケースで共有する。
 */
export function EmbedFallback({
  url,
  caption,
  className,
}: {
  url: string;
  caption?: ReactNode;
  className?: string;
}) {
  const href = safeHref(url);
  return (
    <figure className={cn("my-4", className)}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm underline"
        >
          {url}
        </a>
      ) : (
        <span className="break-all text-sm text-muted-foreground">{url}</span>
      )}
      {caption}
    </figure>
  );
}
