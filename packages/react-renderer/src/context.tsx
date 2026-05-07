"use client";

import { createContext, useContext } from "react";
import type { BlockClassNames, ComponentOverrides } from "./types.js";

export interface NotionRendererContextValue {
  components: ComponentOverrides;
  classNames?: BlockClassNames;
  // 将来の拡張ポイント（#218/#219 で resolveImageUrl / resolvePageUrl / Image / Link を追加予定）
}

export const NotionContext = createContext<NotionRendererContextValue>({
  components: {},
});

export const useNotionContext = () => useContext(NotionContext);
