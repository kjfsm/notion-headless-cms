---
"@notion-headless-cms/core": patch
---

`CollectionClient` に `check(slug, currentVersion)` メソッドを追加。

Notion から最新版を取得して `updatedAt` と比較し、差分があればキャッシュを更新してアイテムを返す。
ページ表示後の1回限りのクライアント再検証エンドポイントの実装に使う。

```ts
const result = await cms.posts.check(slug, post.updatedAt);
// { stale: false } | { stale: true; item: ItemWithRender<T> } | null
```
