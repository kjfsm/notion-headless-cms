"use client";

import type { ElementType } from "react";

import { Card } from "../components/ui/card";
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
 * 左側にタイトル/説明/サイト名+URL、右側に OG 画像。
 * ogp 未指定または空でもホスト名 + URL のリンクカードとして崩れずに描画する。
 *
 * shadcn の CardHeader / CardTitle / CardDescription を挟まないのは、
 * これらが grid layout を被せて画像コンテナの flex 伸縮が崩れ、サムネが
 * 見切れる挙動になるため。Card 直下の生 div でレイアウトを完全に手で組む。
 */
export function OgCard({ url, ogp }: OgCardProps) {
  const { Image: ImageSlot, Link: LinkSlot } = useNotionContext();
  const title = ogp?.title?.trim() || hostname(url);
  const description = ogp?.description?.trim();
  const siteName = ogp?.siteName?.trim() || hostname(url);
  const image = ogp?.image;
  const LinkComp = (LinkSlot ?? "a") as ElementType<React.AnchorHTMLAttributes<HTMLAnchorElement>>;
  const Img = (ImageSlot ?? "img") as ElementType<React.ImgHTMLAttributes<HTMLImageElement>>;

  return (
    <LinkComp href={url} target="_blank" rel="noopener noreferrer" className="block no-underline">
      {/* min-h でカード高さの最低値を保証し、本文は line-clamp + break-words で
          長文・長単語が overflow-hidden で見切れないようにする。Card 既定の
          gap-6 / py-6 を打ち消すため gap-0 / p-0 を明示。 */}
      <Card className="flex min-h-[6.5rem] flex-row items-stretch gap-0 overflow-hidden p-0 transition-colors hover:bg-muted/40">
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
          <div className="line-clamp-2 break-words font-medium leading-snug">{title}</div>
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
