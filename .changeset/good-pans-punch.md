---
"@notion-headless-cms/cli": patch
---

`nhc generate` が生成する Zod スキーマに `title: z.string().nullable().optional()` を追加。`item.title` が型・ランタイム両方で利用可能になる。
