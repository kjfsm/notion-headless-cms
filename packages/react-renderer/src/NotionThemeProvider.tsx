"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

/**
 * テーマ識別子。
 * - `"light"` / `"dark"` は明示モード
 * - `"system"` は `prefers-color-scheme: dark` に追従 (SSR 中は light)
 */
export type NotionTheme = "light" | "dark" | "system";

export interface NotionThemeProviderProps {
  /** 既定 `"system"`。 */
  theme?: NotionTheme;
  /**
   * `theme === "dark"` または `theme === "system"` でダークが選ばれているとき、
   * ルート div に付与するクラス名。Tailwind v4 のデフォルトは `"dark"`。
   */
  darkClassName?: string;
  /**
   * `light` テーマ時にルート div に付与するクラス名。指定しない場合はクラスを足さない。
   * 例: `"light"` を指定すれば `[data-theme=light]` セレクタを使うサイトとも互換になる。
   */
  lightClassName?: string;
  /** 追加で付けたい className。 */
  className?: string;
  children?: ReactNode;
}

/**
 * Notion ブロックを描画するルート要素に theme クラスを付与する Provider。
 * `<NotionRenderer>` をこの中に置くと、`prose dark:prose-invert` のような
 * Tailwind v4 のダークモードクラスが効くようになる。
 *
 * SSR 中は `system` でも light として描画し、hydration 後に `prefers-color-scheme`
 * を見て切り替える。チラつきを完全に避けたい場合は `next-themes` などのライブラリと
 * 併用して、`theme` props で明示的に渡すこと。
 *
 * @example
 * <NotionThemeProvider theme="system">
 *   <NotionRenderer blocks={blocks} className="prose dark:prose-invert" />
 * </NotionThemeProvider>
 */
export function NotionThemeProvider({
  theme = "system",
  darkClassName = "dark",
  lightClassName,
  className,
  children,
}: NotionThemeProviderProps) {
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    if (theme !== "system") return;
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemPrefersDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);

  const resolved = useMemo<"light" | "dark">(() => {
    if (theme === "dark") return "dark";
    if (theme === "light") return "light";
    return systemPrefersDark ? "dark" : "light";
  }, [theme, systemPrefersDark]);

  const classes = ["notion-theme", resolved === "dark" ? darkClassName : lightClassName, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} data-notion-theme={resolved}>
      {children}
    </div>
  );
}
