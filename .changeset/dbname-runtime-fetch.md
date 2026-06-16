---
"@notion-headless-cms/notion-source": patch
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/core": patch
"@notion-headless-cms/cli": patch
---

`cms.<collection>.dbName` を DB 名を埋め込んだプロパティから、実行時に Notion API で取得する非同期メソッド `dbName(): Promise<string | undefined>` に変更（破壊的変更）。

- `nhc generate` は schema に `dbName` を埋め込まなくなった。`cms.<collection>.dbName()` は初回呼び出しで `data_source` を retrieve して表示名を解決し、以降はキャッシュした値を返す。
- 手書き schema で `dbName` を明示した場合はその値を返し、API を叩かない。
- `DataSource` インターフェースに任意メソッド `getDbName?(): Promise<string | undefined>` を追加。core はこれに委譲し、未実装なら `undefined` を返す。
- `CollectionDef.dbName` を廃止（DB 名は DataSource 側で解決する）。
