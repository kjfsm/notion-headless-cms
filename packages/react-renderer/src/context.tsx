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
}

export const NotionContext = createContext<NotionRendererContextValue>({
  components: {},
});

export const useNotionContext = () => useContext(NotionContext);
