// 表示対象 locale 一覧。英語追加時は "en" を `as const` のまま足す。
export const locales = ["ja"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ja";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
