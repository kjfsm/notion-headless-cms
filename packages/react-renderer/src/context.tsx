"use client";

import { createContext, useContext } from "react";
import type {
  AnchorHTMLAttributes,
  ElementType,
  ImgHTMLAttributes,
} from "react";
import type {
  BlockClassNames,
  ComponentOverrides,
  ResolveImageUrlFn,
  ResolvePageUrlFn,
} from "./types.js";

export interface NotionRendererContextValue {
  components: ComponentOverrides;
  classNames?: BlockClassNames;
  resolveImageUrl?: ResolveImageUrlFn;
  resolvePageUrl?: ResolvePageUrlFn;
  Image?: ElementType<ImgHTMLAttributes<HTMLImageElement>>;
  Link?: ElementType<AnchorHTMLAttributes<HTMLAnchorElement>>;
}

export const NotionContext = createContext<NotionRendererContextValue>({
  components: {},
});

export const useNotionContext = () => useContext(NotionContext);
