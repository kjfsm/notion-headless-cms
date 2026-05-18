"use client";

import { renderMarkdown } from "@notion-headless-cms/markdown-html";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

export interface RendererProps {
  /**
   * `cms.posts.find(slug)` 等で取得した content オブジェクト。
   * `{ markdown }` または markdown 文字列のいずれかを受け付ける。
   */
  content: { markdown: string } | string;
  className?: string;
}

/**
 * markdown 戦略 (`@notion-headless-cms/fetch-markdown`) で取得した本文を React に描画する。
 *
 * v1 実装: `@notion-headless-cms/markdown-html` で HTML 化して
 * `dangerouslySetInnerHTML` でマウントする。component overrides は将来対応。
 *
 * HTML 化は `renderMarkdown` が remark/rehype の非同期処理を行うため、初回マウント時に
 * effect で実行する。SSR したい場合は親側で事前に `renderMarkdown(markdown)` を呼んで
 * 文字列を渡す or 別の SSR 経路を使う想定。
 */
export function Renderer(props: RendererProps): ReactElement {
  const markdown =
    typeof props.content === "string" ? props.content : props.content.markdown;
  const [html, setHtml] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = await renderMarkdown(markdown);
      if (!cancelled) setHtml(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [markdown]);
  return (
    <div
      {...(props.className ? { className: props.className } : {})}
      // markdown は Notion API 由来なので信頼するが、悪意ある rich text を防ぐため
      // markdown-html 側で適切にサニタイズされている前提。
      // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown-html の出力を信頼する
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
