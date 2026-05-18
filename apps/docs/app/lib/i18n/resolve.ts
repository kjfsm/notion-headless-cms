import { defaultLocale, isLocale, type Locale } from "./config";

// パスの先頭セグメントが locale ならそれを返し、それ以外は defaultLocale。
// 入力は React Router の URL pathname（例: "/ja/docs/quickstart" or "/docs/quickstart"）。
export function resolveLocale(pathname: string): {
  locale: Locale;
  rest: string;
} {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && isLocale(first)) {
    return { locale: first, rest: `/${segments.slice(1).join("/")}` };
  }
  return { locale: defaultLocale, rest: pathname };
}
