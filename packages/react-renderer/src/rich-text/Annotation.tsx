"use client";

import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import type { ReactNode } from "react";

import { notionInlineColorClass } from "../lib/notion-color";

type Annotations = RichTextItemResponse["annotations"];

export interface AnnotatedProps {
  annotations: Annotations;
  href?: string | null;
  children: ReactNode;
}

/**
 * Notion の annotation (bold/italic/code/strikethrough/underline + color) と
 * オプションのリンクを 1 つの React 要素にラップする。
 * 色の定義は `lib/notion-color.ts` に集約。
 */
export function Annotated({ annotations, href, children }: AnnotatedProps) {
  let node: ReactNode = children;

  if (annotations.code) {
    node = <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{node}</code>;
  } else {
    if (annotations.bold) node = <strong>{node}</strong>;
    if (annotations.italic) node = <em>{node}</em>;
    if (annotations.strikethrough) node = <s>{node}</s>;
    if (annotations.underline) node = <u>{node}</u>;
  }

  const colorClass = notionInlineColorClass(annotations.color);
  if (colorClass) node = <span className={colorClass}>{node}</span>;

  if (href) {
    node = (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:no-underline"
      >
        {node}
      </a>
    );
  }

  return <>{node}</>;
}
