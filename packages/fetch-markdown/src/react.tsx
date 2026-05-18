"use client";

import type { ContentExtension } from "@notion-headless-cms/notion-orm";
import type { ComponentType, ReactNode } from "react";
import { createElement, Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import rehypeRaw from "rehype-raw";
import rehypeReact from "rehype-react";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { PluggableList } from "unified";
import { unified } from "unified";
import { preprocessNotionMarkdown } from "./preprocess";

/**
 * `<Renderer />` の `components` で指定できるコンポーネントマップ。
 * - 標準 HTML 要素 (`a`, `h1`, `code`, ...) を独自実装に差し替え可能
 * - Notion 独自タグ (`callout`, `mention-page`, `mention-date`, `page`, `database`,
 *   `columns`, `column`, `file`, `table_of_contents`) も同じ枠組みで差し替え可能
 *
 * 未指定の Notion 独自タグはこのパッケージ同梱の既定コンポーネントが使われる。
 */
export type RendererComponents = Record<
  string,
  ComponentType<Record<string, unknown>>
>;

export interface RendererProps {
  /**
   * Notion から取得した markdown 文字列、または
   * `cms.posts.find(...)` の content オブジェクト (`{ markdown }`)。
   */
  content: { markdown: string } | string;
  /** 独自コンポーネントで標準タグや Notion タグを差し替える。 */
  components?: RendererComponents;
  /** ラッパー `<div>` に付ける className。 */
  className?: string;
  /**
   * `getMarkdownPlugins()` で unified プラグインを提供する拡張のリスト。
   * 同期プラグイン（`rehype-katex` など）に対応。非同期プラグイン（shiki など）は
   * サーバーサイドで `createNotionMarkdownRenderer` を使うこと。
   */
  extensions?: ContentExtension[];
}

/**
 * Notion `pages/{id}/markdown` の enhanced markdown を React 要素として描画する。
 * パイプライン全体が同期で完結するため SSR (renderToString) でもそのまま動く。
 *
 * - 標準 markdown (heading / list / GFM table / fenced code / inline code / links) は変換
 * - Notion 独自タグ (`<callout>`, `<mention-page>`, ...) は既定の React コンポーネントへマップ
 * - `<span color="red">` など属性ベースの装飾は既定コンポーネントが `data-*` 経由で受け取る
 */
export function Renderer(props: RendererProps): ReactNode {
  const markdown =
    typeof props.content === "string" ? props.content : props.content.markdown;
  const normalized = preprocessNotionMarkdown(markdown);

  const components: RendererComponents = {
    ...defaultNotionComponents,
    ...(props.components ?? {}),
  };

  const extraRemark = (props.extensions ?? []).flatMap(
    (e) => e.getMarkdownPlugins?.()?.remarkPlugins ?? [],
  ) as PluggableList;
  const extraRehype = (props.extensions ?? []).flatMap(
    (e) => e.getMarkdownPlugins?.()?.rehypePlugins ?? [],
  ) as PluggableList;

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(extraRemark)
    // 独自タグは raw HTML として markdown に紛れ込んでくる。
    // allowDangerousHtml + rehype-raw で hast に展開すれば、rehype-react が
    // タグ名で components マップを引いて React 要素を組み立てる。
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(extraRehype)
    .use(rehypeReact, {
      Fragment,
      jsx: jsx as unknown as never,
      jsxs: jsxs as unknown as never,
      components: components as unknown as Record<
        string,
        ComponentType<Record<string, unknown>>
      >,
    });

  const file = processor.processSync(normalized);
  const tree = file.result as ReactNode;
  return props.className ? <div className={props.className}>{tree}</div> : tree;
}

// ──────────────────────────────────────────────────────────────────────────────
// 既定の Notion 独自タグ用コンポーネント
// ──────────────────────────────────────────────────────────────────────────────

type AnyProps = Record<string, unknown> & { children?: ReactNode };

function NotionCallout(props: AnyProps): ReactNode {
  const { icon, color, children, ...rest } = props;
  const cls = ["nhc-callout"];
  if (typeof color === "string") cls.push(`nhc-color-${color}`);
  return createElement(
    "div",
    { ...rest, className: cls.join(" ") },
    typeof icon === "string"
      ? createElement("span", { className: "nhc-callout-icon" }, icon)
      : null,
    createElement("div", { className: "nhc-callout-body" }, children),
  );
}

function NotionMentionPage(props: AnyProps): ReactNode {
  const { url, children } = props;
  return createElement(
    "a",
    {
      href: typeof url === "string" ? url : undefined,
      className: "nhc-mention nhc-mention-page",
      "data-mention": "page",
    },
    children,
  );
}

function NotionMentionDate(props: AnyProps): ReactNode {
  const { start, end } = props;
  const startStr = typeof start === "string" ? start : "";
  const endStr = typeof end === "string" ? end : undefined;
  const label = endStr ? `${startStr} – ${endStr}` : startStr;
  return createElement(
    "time",
    {
      className: "nhc-mention nhc-mention-date",
      dateTime: startStr || undefined,
    },
    label,
  );
}

function NotionPageLink(props: AnyProps): ReactNode {
  const { url, children } = props;
  return createElement(
    "a",
    {
      href: typeof url === "string" ? url : undefined,
      className: "nhc-link nhc-link-page",
      "data-link-type": "page",
    },
    children,
  );
}

function NotionDatabaseLink(props: AnyProps): ReactNode {
  const { url, children } = props;
  return createElement(
    "a",
    {
      href: typeof url === "string" ? url : undefined,
      className: "nhc-link nhc-link-database",
      "data-link-type": "database",
    },
    children,
  );
}

function NotionColumns(props: AnyProps): ReactNode {
  return createElement("div", { className: "nhc-columns" }, props.children);
}

function NotionColumn(props: AnyProps): ReactNode {
  return createElement("div", { className: "nhc-column" }, props.children);
}

function NotionFile(props: AnyProps): ReactNode {
  const { src, children } = props;
  return createElement(
    "a",
    {
      href: typeof src === "string" ? src : undefined,
      className: "nhc-file",
      download: true,
    },
    children,
  );
}

function NotionTOC(): ReactNode {
  // TOC 生成自体は別途 plugin で対応 (v1 はプレースホルダのみ)。
  return createElement("nav", {
    className: "nhc-toc",
    "data-placeholder": "true",
  });
}

function NotionSpan(props: AnyProps): ReactNode {
  // <span color="red"> や <span underline="true"> を class に正規化。
  const { color, underline, children, ...rest } = props;
  const cls: string[] = [];
  if (typeof color === "string") cls.push(`nhc-color-${color}`);
  if (underline === "true" || underline === true) cls.push("nhc-underline");
  if (cls.length === 0) return createElement("span", rest, children);
  return createElement("span", { ...rest, className: cls.join(" ") }, children);
}

export const defaultNotionComponents: RendererComponents = {
  callout: NotionCallout,
  "mention-page": NotionMentionPage,
  "mention-date": NotionMentionDate,
  page: NotionPageLink,
  database: NotionDatabaseLink,
  columns: NotionColumns,
  column: NotionColumn,
  file: NotionFile,
  table_of_contents: NotionTOC,
  span: NotionSpan,
};
