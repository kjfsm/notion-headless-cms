---
"@notion-headless-cms/core": patch
---

公開 API の参照透過性・冪等性・使いやすさを改善（破壊的変更）

### 改名・移動

- `cms.posts.cache.adjacent()` → `cms.posts.adjacent()`（キャッシュ操作でなくクエリのため移動）
- `cms.posts.check()` → `cms.posts.revalidate()`（副作用を名前に反映）
- `CheckResult<T>` → `RevalidateResult<T>`
- `cms.posts.params()` → `cms.posts.slugs()`（戻り値も `{ slug }[]` → `string[]` に変更）
- `GetOptions.fresh` → `GetOptions.bypassCache`
- `ListOptions.status` → `ListOptions.statuses`（配列を受け付けるのに単数形は誤解を招くため）
- `ItemWithRender<T>` → `ItemWithContent<T>`

### 分割・追加

- `cache.invalidate(slug?)` を `cache.invalidate()` と `cache.invalidateItem(slug)` に分割（偶発的な全体削除を防止）
- `item.render()` を `item.html()` / `item.markdown()` / `item.blocks()` に分割（IDE 補完・可読性向上、AST アクセスも追加）
- `cache.warm()` の戻り値 `failed: number` → `failed: Array<{ slug, error }>`（何が失敗したかデバッグ可能に）
- `CreateCMSOptions.renderer` をオプション化（未指定時は `@notion-headless-cms/renderer` を動的 import）
