import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { Config } from "@react-router/dev/config";

// docs/<locale>/**/*.md を再帰列挙して slug 配列を返す。
// app/lib/markdown/load.ts は Vite の import.meta.glob を使う前提で
// 設定ファイルからは呼べないため、ビルド時専用に fs で同等の列挙を行う。
function listDocSlugs(locale: string): string[] {
  const docsDir = join(import.meta.dirname, "..", "..", "docs", locale);
  const slugs: string[] = [];
  function walk(dir: string, prefix: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith(".md")) {
        slugs.push(`${prefix}${entry.name.replace(/\.md$/, "")}`);
      }
    }
  }
  walk(docsDir, "");
  return slugs;
}

export default {
  // Notion 由来のページ（/、/:slug）と /api/* は Workers で SSR を続ける。
  ssr: true,
  // /docs（一覧）と /docs/<locale>/<slug>（個別 md）だけビルド時に静的 HTML 化する。
  async prerender() {
    const paths: string[] = ["/docs"];
    for (const slug of listDocSlugs("ja")) {
      paths.push(`/docs/ja/${slug}`);
    }
    return paths;
  },
} satisfies Config;
