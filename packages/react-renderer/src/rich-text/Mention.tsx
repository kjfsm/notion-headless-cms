"use client";

import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import { Link as LinkIcon } from "lucide-react";
import type { ElementType } from "react";
import { useNotionContext } from "../context";

export interface MentionProps {
  item: Extract<RichTextItemResponse, { type: "mention" }>;
}

/** rich_text の mention 種別を React で描画する。link_mention は Notion 風カードに近い見た目。 */
export function Mention({ item }: MentionProps) {
  const { Image: ImageSlot, Link: LinkSlot } = useNotionContext();
  const m = item.mention;
  const plainText = item.plain_text;

  const LinkComp = (LinkSlot ?? "a") as ElementType<
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  >;
  const Img = (ImageSlot ?? "img") as ElementType<
    React.ImgHTMLAttributes<HTMLImageElement>
  >;

  if (m.type === "link_mention") {
    const lm = m.link_mention;
    return (
      <LinkComp
        href={lm.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-baseline gap-1 rounded px-1 hover:bg-muted"
      >
        {lm.icon_url ? (
          <Img
            src={lm.icon_url}
            alt=""
            aria-hidden
            className="inline-block size-3.5 self-center rounded-sm"
          />
        ) : (
          <LinkIcon className="inline-block size-3.5 self-center" aria-hidden />
        )}
        {lm.link_provider ? (
          <span className="text-xs text-muted-foreground">
            {lm.link_provider}
          </span>
        ) : null}
        <strong className="font-medium">{lm.title ?? lm.href}</strong>
      </LinkComp>
    );
  }

  if (m.type === "link_preview") {
    return (
      <LinkComp
        href={m.link_preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-baseline gap-1 rounded px-1 hover:bg-muted"
      >
        <LinkIcon className="inline-block size-3.5 self-center" aria-hidden />
        <span>{plainText || m.link_preview.url}</span>
      </LinkComp>
    );
  }

  if (m.type === "page") {
    return (
      <span className="inline-flex items-baseline gap-1 rounded bg-muted px-1">
        <span aria-hidden>📋</span>
        <span>{plainText || m.page.id}</span>
      </span>
    );
  }

  if (m.type === "database") {
    return (
      <span className="inline-flex items-baseline gap-1 rounded bg-muted px-1">
        <span aria-hidden>🗄️</span>
        <span>{plainText || m.database.id}</span>
      </span>
    );
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
    if ("url" in emoji && emoji.url) {
      return (
        <Img
          src={String(emoji.url)}
          alt={"name" in emoji ? String(emoji.name) : ""}
          className="inline-block size-[1em] align-baseline"
        />
      );
    }
    return <>{plainText}</>;
  }

  return <>{plainText}</>;
}
