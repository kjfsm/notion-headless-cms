---
"@notion-headless-cms/cms": patch
---

`list()` の戻り値の `meta` をスキーマ由来の型に絞り込むようにした（`find()` と一貫）。

- これまで `list()` は `ListResult<IndexEntry>` を返し `meta` が `JsonValue` だったが、`ListResult<CollectionIndexEntry<C>>` に変更し `meta` を当該コレクションの `InferEntry<C>` として型付けする
- ドライバが index にも本体と同一の full meta を書き込む現状の実装に基づく型付けのためランタイムは無改修（型のみの強化）
- `CollectionIndexEntry` / `CollectionEntrySnapshot` を型エクスポートに追加
