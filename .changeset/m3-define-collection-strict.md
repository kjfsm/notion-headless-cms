---
"@notion-headless-cms/core": minor
---

`defineCollection<T>()` ヘルパーと `StrictCollectionDef<T>` 型を新設し、`slugField` / `statusField` を `keyof T & string` で型ガードできるようにした (Issue #314 / M3)。CLI 生成スキーマや手書きの schema で `defineCollection<PostItem>({ slugField: "slag" })` のような誤フィールド名を **コンパイル時に検出**できる。`CollectionDef<T>` 自体は後方互換のため variance を維持。
