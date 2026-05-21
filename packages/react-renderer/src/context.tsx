"use client";

import type {
  AnchorHTMLAttributes,
  ElementType,
  ImgHTMLAttributes,
} from "react";
import { createContext, useContext } from "react";
import type { ExtractedHeading } from "./lib/extract-headings.js";
import type {
  BlockClassNames,
  ComponentOverrides,
  ResolveImageUrlFn,
  ResolvePageTitleFn,
  ResolvePageUrlFn,
} from "./types.js";

/**
 * レスポンシブ画像生成に使う幅 (px) のリスト。
 * `Image` ブロックが proxy URL を受け取った場合、`?w={width}` を付けた `srcSet` を生成する。
 */
export type ImageSizes = readonly number[];

export interface NotionRendererContextValue {
  components: ComponentOverrides;
  classNames?: BlockClassNames;
  resolveImageUrl?: ResolveImageUrlFn;
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
}

export const NotionContext = createContext<NotionRendererContextValue>({
  components: {},
});

export const useNotionContext = () => useContext(NotionContext);
