"use client";

import type { ElementType } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useNotionContext } from "../context";

/**
 * notion-orm が embed/bookmark ブロックに付与する `ogp` フィールドと同形状の型。
 * react-renderer は notion-orm に直接依存しないため、構造的に互換な型を独自に持つ。
 */
export interface OgCardData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export interface OgCardProps {
  url: string;
  ogp?: OgCardData;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Notion 本家のブックマークカード風レイアウト。
 * 左側 CardHeader（タイトル/説明/サイト名+URL）と右側 OG 画像。
 * ogp 未指定または空でもホスト名 + URL のリンクカードとして崩れずに描画する。
 */
export function OgCard({ url, ogp }: OgCardProps) {
  const { Image: ImageSlot, Link: LinkSlot } = useNotionContext();
  const title = ogp?.title?.trim() || hostname(url);
  const description = ogp?.description?.trim();
  const siteName = ogp?.siteName?.trim() || hostname(url);
  const image = ogp?.image;
  const LinkComp = (LinkSlot ?? "a") as ElementType<
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  >;
  const Img = (ImageSlot ?? "img") as ElementType<
    React.ImgHTMLAttributes<HTMLImageElement>
  >;

  return (
    <LinkComp
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block no-underline"
    >
      <Card className="flex min-h-[6.5rem] flex-row items-stretch gap-0 overflow-hidden py-0 transition-colors hover:bg-muted/40">
        <CardHeader className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-4">
          <CardTitle className="line-clamp-2 break-words text-sm font-medium leading-snug">
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="line-clamp-2 break-words text-xs">
              {description}
            </CardDescription>
          ) : null}
          <CardDescription className="mt-auto truncate pt-2 text-xs text-muted-foreground/60">
            {siteName} · {url}
          </CardDescription>
        </CardHeader>
        {image ? (
          <div className="ml-auto w-36 shrink-0 self-stretch bg-muted sm:w-48 md:w-64">
            <Img
              src={image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="not-prose m-0 h-full w-full object-cover"
            />
          </div>
        ) : null}
      </Card>
    </LinkComp>
  );
}
