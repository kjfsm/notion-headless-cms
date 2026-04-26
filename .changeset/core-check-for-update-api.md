---
"@notion-headless-cms/core": patch
---

`CollectionClient` に更新検知プリミティブ `checkForUpdate` / `checkListForUpdate` を追加する

## 新規 API

- `checkForUpdate({ slug, since })` — 指定アイテムが `since` 以降に更新されたか 1 コールで確認する。更新あり時は最新 `ItemWithContent` を返す
- `checkListForUpdate({ since, filter? })` — リスト全体が `since` 以降に更新されたか確認する。更新あり時は最新 `items` と `version` を返す
- `revalidateAll()` — コレクション全体のキャッシュを無効化する（旧 `revalidate()` / `revalidate("all")` の置き換え）

## 破壊的変更

- `getList()` の戻り値が `T[]` から `{ items: T[]; version: string }` に変更。`version` は `DataSource.getListVersion()` で計算したフィルタ済みアイテムの識別子
- `revalidate()` の引数が `scope?: "all" | { slug: string }` から `slug: string` に変更。引数なしでの全件無効化は `revalidateAll()` を使う

## 新規エクスポート型

- `CheckForUpdateResult<T>`
- `CheckListForUpdateResult<T>`
- `GetListResult<T>`
