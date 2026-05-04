"use client";

import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

type Annotations = RichTextItemResponse["annotations"];

// Notion の color 値 (例: "red", "red_background") を Tailwind ユーティリティに変換。
// 任意値構文で Notion のパレットに近い色を表現する。
const COLOR_FG: Record<string, string> = {
  gray: "text-gray-500",
  brown: "text-amber-800",
  orange: "text-orange-500",
  yellow: "text-yellow-600",
  green: "text-green-600",
  blue: "text-blue-600",
  purple: "text-purple-600",
  pink: "text-pink-600",
  red: "text-red-600",
};

const COLOR_BG: Record<string, string> = {
  gray_background: "bg-gray-100",
  brown_background: "bg-amber-100",
  orange_background: "bg-orange-100",
  yellow_background: "bg-yellow-100",
  green_background: "bg-green-100",
  blue_background: "bg-blue-100",
  purple_background: "bg-purple-100",
  pink_background: "bg-pink-100",
  red_background: "bg-red-100",
};

export interface AnnotatedProps {
  annotations: Annotations;
  href?: string | null;
  children: ReactNode;
}

/**
 * Notion の annotation (bold/italic/code/strikethrough/underline + color) と
 * オプションのリンクを 1 つの React 要素にラップする。
 */
export function Annotated({ annotations, href, children }: AnnotatedProps) {
  let node: ReactNode = children;

  if (annotations.code) {
    node = (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
        {node}
      </code>
    );
  } else {
    if (annotations.bold) node = <strong>{node}</strong>;
    if (annotations.italic) node = <em>{node}</em>;
    if (annotations.strikethrough) node = <s>{node}</s>;
    if (annotations.underline) node = <u>{node}</u>;
  }

  const color = annotations.color !== "default" ? annotations.color : null;
  if (color) {
    const cls = color.endsWith("_background")
      ? COLOR_BG[color]
      : COLOR_FG[color];
    if (cls) {
      node = (
        <span
          className={cn(cls, color.endsWith("_background") && "rounded px-1")}
        >
          {node}
        </span>
      );
    }
  }

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
