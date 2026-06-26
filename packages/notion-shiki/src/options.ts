import type { Options as RehypePrettyCodeOptions } from "rehype-pretty-code";

/** `notionShiki()` / `highlightCodeBlocks()` 共通のテーマオプション。 */
export interface NotionShikiOptions {
  /**
   * ライト/ダーク両対応のデュアルテーマ。`.dark` クラスで切り替わる CSS 変数
   * （`--shiki-light` / `--shiki-dark`）が出力される。
   * 既定: `{ light: "github-light", dark: "github-dark" }`。
   */
  themes?: { light: string; dark: string };
  /** 単一テーマ。`themes` 未指定時のフォールバック。 */
  theme?: string;
}

/** Notion の言語名を shiki が解釈できる名前へ正規化する。 */
export function normalizeLang(lang: string): string {
  const l = lang.trim().toLowerCase();
  if (l === "" || l === "plain text" || l === "plain_text" || l === "plaintext")
    return "text";
  return l;
}

export function rehypePrettyCodeOptions(
  opts?: NotionShikiOptions,
): RehypePrettyCodeOptions {
  const theme = (opts?.themes ??
    opts?.theme ?? {
      light: "github-light",
      dark: "github-dark",
    }) as RehypePrettyCodeOptions["theme"];
  return {
    theme,
    // 背景はカード／figure 側で制御するため shiki 既定背景は無効化する。
    keepBackground: false,
  };
}
