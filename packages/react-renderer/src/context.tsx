"use client";

import type { AnchorHTMLAttributes, ElementType, ImgHTMLAttributes } from "react";
import { createContext, useContext } from "react";

import type { ExtractedHeading } from "./lib/extract-headings.js";
import type {
  BlockClassNames,
  ComponentOverrides,
  PageLinkMap,
  ResolveImageUrlFn,
  ResolvePageTitleFn,
  ResolvePageUrlFn,
} from "./types.js";

/**
 * レスポンシブ画像生成に使う幅 (px) のリスト。
 * `Image` ブロックが proxy URL を受け取った場合、`?w={width}` を付けた `srcSet` を生成する。
 */
export type ImageSizes = readonly number[];

/**
 * `NotionRenderer` がツリー全体に提供する Context の値。
 * カスタムブロックコンポーネントから `useNotionContext()` で参照する。
 *
 * @see {@link useNotionContext}
 */
export interface NotionRendererContextValue {
  components: ComponentOverrides;
  classNames?: BlockClassNames;
  resolveImageUrl?: ResolveImageUrlFn;
  /** Notion 内部リンクの解決マップ（`buildPageLinkMap` の戻り値）。 */
  pageLinks?: PageLinkMap;
  resolvePageUrl?: ResolvePageUrlFn;
  resolvePageTitle?: ResolvePageTitleFn;
  Image?: ElementType<ImgHTMLAttributes<HTMLImageElement>>;
  Link?: ElementType<AnchorHTMLAttributes<HTMLAnchorElement>>;
  /** ページ全体の見出し一覧（TOC 用、`NotionRenderer` が自動抽出）。 */
  headings?: ExtractedHeading[];
  /** numbered_list の入れ子深さ。`<ol>` の list-style ローテーションに使う。 */
  listDepth?: number;
  /**
   * `srcSet` 生成に使う幅 (px) のリスト。指定すると `Image` ブロックは
   * `?w={width}` クエリ付きの URL を `srcSet` として出力する。
   */
  imageSizes?: ImageSizes;
  /** `Image` ブロックに渡す `sizes` 属性 (`srcSet` と組合せて使う)。 */
  imageSizesAttr?: string;
  /** OGP カードのページアクセス時取得エンドポイント。`useOgp` が参照する。 */
  ogpEndpoint?: string;
}

export const NotionContext = createContext<NotionRendererContextValue>({
  components: {},
});

/**
 * `NotionRenderer` の Context にアクセスする hook。
 * カスタムブロックコンポーネントから `components` / `classNames` / `resolveImageUrl` などを取得する。
 *
 * @example
 * ```tsx
 * function MyCodeBlock({ block, className }: BlockComponentProps) {
 *   const { Link } = useNotionContext();
 *   return <pre className={className}><code>...</code></pre>;
 * }
 * ```
 *
 * @see {@link NotionRendererContextValue}
 */
export const useNotionContext = () => useContext(NotionContext);
