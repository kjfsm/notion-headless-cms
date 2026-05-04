"use client";

import { Card } from "../components/ui/card";

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
 * 左側にタイトル/説明/サイト名+URL、右側に OG 画像。
 * ogp 未指定または空でもホスト名 + URL のリンクカードとして崩れずに描画する。
 */
export function OgCard({ url, ogp }: OgCardProps) {
  const title = ogp?.title?.trim() || hostname(url);
  const description = ogp?.description?.trim();
  const siteName = ogp?.siteName?.trim() || hostname(url);
  const image = ogp?.image;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block no-underline"
    >
      <Card className="flex flex-row overflow-hidden p-0 transition-colors hover:bg-muted/40">
        <div className="flex min-w-0 flex-[4_1_180px] flex-col gap-1 p-4">
          <div className="truncate font-medium">{title}</div>
          {description ? (
            <div className="line-clamp-2 text-xs text-muted-foreground">
              {description}
            </div>
          ) : null}
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {siteName} · {url}
          </div>
        </div>
        {image ? (
          <div className="relative flex-[1_1_180px]">
            <img
              src={image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ) : null}
      </Card>
    </a>
  );
}
