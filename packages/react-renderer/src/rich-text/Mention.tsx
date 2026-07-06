"use client";

import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import { Link as LinkIcon } from "lucide-react";
import type { ElementType } from "react";

import { useNotionContext } from "../context";
import { normalizePageId } from "../lib/normalize-page-id";
import { safeHref, safeMediaSrc } from "../lib/safe-url.js";

export interface MentionProps {
  item: Extract<RichTextItemResponse, { type: "mention" }>;
}

/** rich_text の mention 種別を React で描画する。link_mention は Notion 風カードに近い見た目。 */
export function Mention({ item }: MentionProps) {
  const {
    Image: ImageSlot,
    Link: LinkSlot,
    pageLinks,
    resolvePageUrl,
    resolvePageTitle,
  } = useNotionContext();
  const m = item.mention;
  const plainText = item.plain_text;

  const LinkComp = (LinkSlot ?? "a") as ElementType<React.AnchorHTMLAttributes<HTMLAnchorElement>>;
  const Img = (ImageSlot ?? "img") as ElementType<React.ImgHTMLAttributes<HTMLImageElement>>;

  if (m.type === "link_mention") {
    const lm = m.link_mention;
    const href = safeHref(lm.href);
    const iconSrc = safeMediaSrc(lm.icon_url);
    const className = "inline-flex items-baseline gap-1 rounded px-1 hover:bg-muted";
    const inner = (
      <>
        {iconSrc ? (
          <Img
            src={iconSrc}
            alt=""
            aria-hidden
            className="inline-block size-3.5 self-center rounded-sm"
          />
        ) : (
          <LinkIcon className="inline-block size-3.5 self-center" aria-hidden />
        )}
        {lm.link_provider ? (
          <span className="text-xs text-muted-foreground">{lm.link_provider}</span>
        ) : null}
        <strong className="font-medium">{lm.title ?? lm.href}</strong>
      </>
    );
    // 危険なスキームの href はリンク化せず、非リンクの span で表示する。
    if (!href) {
      return <span className={className}>{inner}</span>;
    }
    return (
      <LinkComp href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </LinkComp>
    );
  }

  if (m.type === "link_preview") {
    const href = safeHref(m.link_preview.url);
    const className = "inline-flex items-baseline gap-1 rounded px-1 hover:bg-muted";
    const inner = (
      <>
        <LinkIcon className="inline-block size-3.5 self-center" aria-hidden />
        <span>{plainText || m.link_preview.url}</span>
      </>
    );
    if (!href) {
      return <span className={className}>{inner}</span>;
    }
    return (
      <LinkComp href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </LinkComp>
    );
  }

  if (m.type === "page") {
    // pageLinks → resolvePageUrl の順で解決。どちらも無ければ従来どおり素の表示。
    const resolved = pageLinks?.[normalizePageId(m.page.id)];
    const href = safeHref(resolved?.href ?? resolvePageUrl?.(m.page.id));
    const label = resolved?.title || resolvePageTitle?.(m.page.id) || plainText || m.page.id;
    const inner = (
      <>
        <span aria-hidden>📋</span>
        <span>{label}</span>
      </>
    );
    if (href) {
      return (
        <LinkComp
          href={href}
          className="inline-flex items-baseline gap-1 rounded px-1 hover:bg-muted"
        >
          {inner}
        </LinkComp>
      );
    }
    return <span className="inline-flex items-baseline gap-1 rounded bg-muted px-1">{inner}</span>;
  }

  if (m.type === "database") {
    const resolved = pageLinks?.[normalizePageId(m.database.id)];
    const href = safeHref(resolved?.href ?? resolvePageUrl?.(m.database.id));
    const label =
      resolved?.title || resolvePageTitle?.(m.database.id) || plainText || m.database.id;
    const inner = (
      <>
        <span aria-hidden>🗄️</span>
        <span>{label}</span>
      </>
    );
    if (href) {
      return (
        <LinkComp
          href={href}
          className="inline-flex items-baseline gap-1 rounded px-1 hover:bg-muted"
        >
          {inner}
        </LinkComp>
      );
    }
    return <span className="inline-flex items-baseline gap-1 rounded bg-muted px-1">{inner}</span>;
  }

  if (m.type === "date") {
    const d = m.date;
    const label = d.end ? `${d.start} → ${d.end}` : d.start;
    return <time className="text-muted-foreground">{label}</time>;
  }

  if (m.type === "user") {
    const u = m.user;
    const name = "name" in u && u.name ? u.name : "id" in u ? u.id : "unknown";
    return <span className="text-muted-foreground">@{name}</span>;
  }

  if (m.type === "custom_emoji") {
    const emoji = m.custom_emoji;
    const emojiSrc = "url" in emoji && emoji.url ? safeMediaSrc(String(emoji.url)) : undefined;
    if (emojiSrc) {
      return (
        <Img
          src={emojiSrc}
          alt={"name" in emoji ? String(emoji.name) : ""}
          className="inline-block size-[1em] align-baseline"
        />
      );
    }
    return <>{plainText}</>;
  }

  return <>{plainText}</>;
}
