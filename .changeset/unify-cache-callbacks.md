---
"@notion-headless-cms/core": minor
---

キャッシュフック API の統一と型安全性の向上

## 破壊的変更

### 1. `onListCacheHit` の引数を `CachedItemList<T>` 単引数に統一

`onCacheHit` が `CachedItem<T>` オブジェクト一つを受け取るのと対称になるよう変更。

```diff
- onListCacheHit?: (items: T[], cachedAt: number) => void;
+ onListCacheHit?: (list: CachedItemList<T>) => void;
```

移行:
```ts
// Before
onListCacheHit: (items, cachedAt) => { ... }

// After
onListCacheHit: ({ items, cachedAt }) => { ... }
```

### 2. `onCacheUpdate` → `onCacheRevalidated` にリネーム

SWR バックグラウンド再検証でキャッシュに書き込んだことを明示する名前に変更。

```diff
- onCacheUpdate?: (slug: string, item: CachedItem<T>) => void;
+ onCacheRevalidated?: (slug: string, item: CachedItem<T>) => void;
```

### 3. `onListCacheUpdate` → `onListCacheRevalidated` にリネーム、引数も `CachedItemList<T>` に変更

```diff
- onListCacheUpdate?: (items: T[]) => void;
+ onListCacheRevalidated?: (list: CachedItemList<T>) => void;
```

## 新機能

### 4. `logLevel` オプション（`CreateCMSOptions`）

指定したレベル未満のログを内部で抑制する。Cloudflare Workers Observability のように debug ログが課金対象になる環境で有用。

```ts
createCMS({ dataSources, preset: "node", logLevel: "info" })
```

### 5. `CollectionSemantics<T>` にコレクション固有フック

`collections` オプションでコレクションごとに型付きフックを定義できる。アプリ側が `CMSHooks<Post>` を直接記述せずに済む。

```ts
createCMS({
  dataSources: { posts: createNotionCollection<Post>({ ... }) },
  collections: {
    posts: {
      slug: "slug",
      hooks: {
        // item の型が Post に自動推論される
        onCacheHit: (slug, item) => console.log(item.item.title),
      },
    },
  },
})
```
