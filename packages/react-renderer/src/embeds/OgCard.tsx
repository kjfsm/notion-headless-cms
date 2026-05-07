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
      {/* min-h でカード高さの最低値を保証し、本文は line-clamp + break-words で
          長文・長単語が overflow-hidden で見切れないようにする */}
      <Card className="flex min-h-[6.5rem] flex-row items-stretch overflow-hidden p-0 transition-colors hover:bg-muted/40">
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
          <div className="line-clamp-2 break-words font-medium leading-snug">
            {title}
          </div>
          {description ? (
            <div className="line-clamp-2 break-words text-xs text-muted-foreground">
              {description}
            </div>
          ) : null}
          <div className="mt-auto truncate pt-2 text-xs text-muted-foreground/60">
            {siteName} · {url}
          </div>
        </div>
        {image ? (
          <div className="ml-auto w-32 shrink-0 self-stretch bg-muted sm:w-40 md:w-56">
            <img
              src={image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="not-prose m-0 h-full w-full object-cover"
            />
          </div>
        ) : null}
      </Card>
    </a>
  );
}
