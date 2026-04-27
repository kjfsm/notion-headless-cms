---
"@notion-headless-cms/notion-embed": patch
---

`rehype-sanitize` スキーマの HTML 属性名を HAST プロパティ名に修正（`frameborder`→`frameBorder`、`allowfullscreen`→`allowFullScreen`）。これにより YouTube・Vimeo・Steam・汎用 iframe の `frameborder` / `allowfullscreen` 属性が削除されなくなった。
