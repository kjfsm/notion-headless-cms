---
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/notion-source": patch
"@notion-headless-cms/cli": patch
---

slug を持たないデータ専用コレクション（`kind: "data"`）をサポートする

URL を持たないキー・バリュー型の DB など、slug フィールドが不要なコレクションを
`kind: "data"` で宣言できるようにする。

- `nhc.config.ts` に `kind: "data"` を指定すると生成スキーマに `kind: "data"` が含まれ、`slugField` が出力されない
- `CollectionSchemaEntry` を `PageCollectionSchemaEntry | DataCollectionSchemaEntry` の判別共用体に変更
- `CMSItemFromSchema` はデータコレクションに対し `slug` を型から除去する（`Omit<BaseContentItem, "slug">`）
- `CollectionsFromSchema` はデータコレクションに対し `DataCollectionDef` を使用する
- `mapItemFromPropertyMap` に省略可能な `slugField` 引数を追加。未指定時は slug を設定せず空チェックもスキップする
