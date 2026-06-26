---
"@notion-headless-cms/cli": patch
---

コード生成のフォールバックフィールド型を BaseContentItem と一致させる

`status` と `publishedAt` のフォールバック型が `string` だったが、`BaseContentItem` は `string | null` を許容するため型不整合が生じていた。また `isInTrash` が生成インターフェースに含まれていなかった。
