import type { Locale } from "../i18n/config";
import { parseFrontmatter } from "./frontmatter";

// Vite の import.meta.glob はビルド時に静的解析するため、`?raw` で生 md 文字列を取り込む。
// Cloudflare Workers では fs アクセス不可なので、ここでバンドル時にすべて取り込む方針。
const RAW_JA = import.meta.glob<string>("../../../../docs/ja/**/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

export interface DocFrontmatter {
  title?: string;
  description?: string;
  order?: number;
  category?: string;
}

export interface DocEntry {
  /** locale 配下の slug（例: "quickstart", "recipes/cloudflare-workers"） */
  slug: string;
  /** locale */
  locale: Locale;
  /** リポジトリルートからの相対パス（"Edit on GitHub" リンク生成用） */
  filePath: string;
  /** frontmatter */
  frontmatter: DocFrontmatter;
  /** 本文（frontmatter 除去後の md） */
  body: string;
}

function buildEntries(
  raw: Record<string, string>,
  locale: Locale,
  prefix: string,
): Map<string, DocEntry> {
  const result = new Map<string, DocEntry>();
  for (const [absPath, content] of Object.entries(raw)) {
    // absPath 例: "../../../../docs/ja/quickstart.md"
    // slug 例:   "quickstart"
    const marker = `/${locale}/`;
    const idx = absPath.indexOf(marker);
    if (idx === -1) continue;
    const after = absPath.slice(idx + marker.length); // "quickstart.md" or "recipes/foo.md"
    const slug = after.replace(/\.md$/, "");
    const parsed = parseFrontmatter(content);
    const filePath = `${prefix}${locale}/${after}`;
    result.set(slug, {
      slug,
      locale,
      filePath,
      frontmatter: parsed.data as unknown as DocFrontmatter,
      body: parsed.content,
    });
  }
  return result;
}

const ENTRIES: Record<Locale, Map<string, DocEntry>> = {
  ja: buildEntries(RAW_JA, "ja", "docs/"),
};

export function getDocEntry(locale: Locale, slug: string): DocEntry | null {
  return ENTRIES[locale].get(slug) ?? null;
}

export function listDocEntries(locale: Locale): DocEntry[] {
  return Array.from(ENTRIES[locale].values()).sort((a, b) => {
    const oa = a.frontmatter.order ?? 100;
    const ob = b.frontmatter.order ?? 100;
    if (oa !== ob) return oa - ob;
    return a.slug.localeCompare(b.slug);
  });
}
