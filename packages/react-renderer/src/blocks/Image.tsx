"use client";

import type { ImageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { ElementType } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog.js";
import { useNotionContext } from "../context";
import { getFileUrl } from "../lib/notion-file";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

/**
 * `src` に対して `?w={width}` クエリ付きの srcSet を生成する。
 * 既存のクエリと衝突しないよう URL コンストラクタを使って構築する。
 * URL コンストラクタが失敗した場合 (相対パスなど) は素朴に `?w=` を末尾に付ける。
 */
function buildSrcSet(
  src: string,
  sizes: readonly number[],
): string | undefined {
  if (sizes.length === 0) return undefined;
  return sizes
    .map((w) => {
      let url: string;
      try {
        const u = new URL(src, "http://__nhc.local");
        u.searchParams.set("w", String(w));
        url =
          u.origin === "http://__nhc.local"
            ? `${u.pathname}${u.search}`
            : u.toString();
      } catch {
        url = src.includes("?") ? `${src}&w=${w}` : `${src}?w=${w}`;
      }
      return `${url} ${w}w`;
    })
    .join(", ");
}

/**
 * caption が「単一の URL のみ」で構成される場合に、そのリンク URL を返す。
 * Notion の image ブロックには画像自体のリンクを表す API フィールドが無いため、
 * caption に URL だけを入れる規約で「クリックでリンクへ飛ぶ画像」を表現する。
 * 説明テキスト付きリンク (plain_text ≠ URL) は従来どおり caption として扱うため除外する。
 */
function captionLinkUrl(
  caption: ImageBlockObjectResponse["image"]["caption"],
): string | null {
  const item = caption.length === 1 ? caption[0] : undefined;
  if (!item) return null;
  const href =
    item.type === "text" ? (item.text.link?.url ?? item.href) : item.href;
  if (!href) return null;
  if (item.plain_text.trim() !== href.trim()) return null;
  return href;
}

export function Image({
  block,
  className,
}: BlockComponentProps<ImageBlockObjectResponse>) {
  const {
    resolveImageUrl,
    Image: ImageSlot,
    imageSizes,
    imageSizesAttr,
  } = useNotionContext();
  const rawUrl = getFileUrl(block.image);
  const src = resolveImageUrl ? resolveImageUrl(rawUrl, block) : rawUrl;
  const alt = block.image.caption.map((rt) => rt.plain_text).join("") || "";
  const Img = (ImageSlot ?? "img") as ElementType<
    React.ImgHTMLAttributes<HTMLImageElement>
  >;

  // Notion 署名 URL は失効するため srcSet 化しない (resolveImageUrl で proxy 化された場合のみ意味がある)。
  // 「proxy 化されたかどうか」は src と rawUrl の比較で判定する。
  const isProxied = !!resolveImageUrl && src !== rawUrl;
  const srcSet =
    isProxied && imageSizes ? buildSrcSet(src, imageSizes) : undefined;

  const linkUrl = captionLinkUrl(block.image.caption);
  if (linkUrl) {
    // クリックでリンクへ遷移させるため、ズーム用 Dialog は使わない。
    // caption は URL のみのため説明文 alt も持たせない。
    return (
      <figure className={className}>
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Img
            src={src}
            srcSet={srcSet}
            sizes={srcSet ? imageSizesAttr : undefined}
            alt=""
            loading="lazy"
            className="h-auto max-w-full rounded-lg"
          />
        </a>
      </figure>
    );
  }

  return (
    <figure className={className}>
      <Dialog>
        <DialogTrigger
          className="block cursor-zoom-in border-0 bg-transparent p-0"
          aria-label="画像を拡大表示"
        >
          <Img
            src={src}
            srcSet={srcSet}
            sizes={srcSet ? imageSizesAttr : undefined}
            alt={alt}
            loading="lazy"
            className="h-auto max-w-full rounded-lg"
          />
        </DialogTrigger>
        <DialogContent
          showCloseButton={false}
          className="max-w-[calc(100%-2rem)] border-0 bg-transparent p-0 shadow-none sm:max-w-[90vw]"
        >
          <DialogTitle className="sr-only">{alt || "画像"}</DialogTitle>
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-full object-contain"
          />
        </DialogContent>
      </Dialog>
      <Caption value={block.image.caption} />
    </figure>
  );
}
