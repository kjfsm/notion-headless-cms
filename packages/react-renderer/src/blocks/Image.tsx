"use client";

import type { ImageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { type ElementType, useCallback, useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // ESC キーでモーダルを閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  return (
    <>
      <figure className={className}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block cursor-zoom-in border-0 bg-transparent p-0"
          aria-label="画像を拡大表示"
        >
          <Img
            src={src}
            alt={alt}
            loading="lazy"
            className="h-auto max-w-full rounded-lg"
          />
        </button>
        <Caption value={block.image.caption} />
      </figure>

      {open && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: ESC キーは useEffect で処理済み
        <div
          role="dialog"
          aria-modal="true"
          aria-label="画像ライトボックス"
          onClick={close}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
        >
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </>
  );
}
