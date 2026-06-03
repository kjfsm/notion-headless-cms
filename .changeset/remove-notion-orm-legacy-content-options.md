---
"@notion-headless-cms/notion-orm": minor
---

`createNotionCollection` のトップレベル `blocks` / `ogp` / `enrichers` オプションを削除した（v0.3.x で `@deprecated` 化済み）。本文取得戦略は `content: blocksFetcher({ blocks, ogp, enrichers })` に集約されているため、そちらへ移行すること。移行手順: `docs/ja/migration/blocks-ogp-enrichers.md`。
