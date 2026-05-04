"use client";

// table_of_contents 自体は children を持たないため、現在のページのヘディング情報が必要。
// 単独描画では情報が無いので、利用側で <NotionRenderer> ラッパに目次注入する想定の薄い実装にする。
export function TableOfContents() {
  return (
    <nav
      aria-label="table of contents"
      className="my-3 rounded-lg border p-3 text-sm"
    >
      <p className="text-muted-foreground">Table of contents</p>
    </nav>
  );
}
