---
"@notion-headless-cms/core": minor
"@notion-headless-cms/cache-r2": minor
---

`createCMS` の開発者体験を改善する新 API を追加（Prisma / better-auth スタイル）。

## 追加 API

### `preset` オプション (`@notion-headless-cms/core`)

`createCMS` に `preset: "node"` と `ttlMs` を直接指定できるようになった。
`nodePreset()` のスプレッドが不要になる。

```ts
// Before
const cms = createCMS({ ...nodePreset({ ttlMs: 5 * 60_000 }), dataSources });

// After
const cms = createCMS({ dataSources, preset: "node", ttlMs: 5 * 60_000 });
```

既存のスプレッドパターンは引き続き動作する（後方互換）。

### `createCloudflareFactory` (`@notion-headless-cms/cache-r2`)

Cloudflare Workers 向けのファクトリ関数。全 Cloudflare example で繰り返されていたボイラープレートを1行に削減する。

```ts
// Before（手書きのラッパーが必要だった）
export function createCMS(env: Env) {
  return createCore({ ...cloudflarePreset({ env, ttlMs: 5 * 60_000 }), dataSources });
}

// After
export const createCMS = createCloudflareFactory({ dataSources, ttlMs: 5 * 60_000 });
// 使い方は変わらない: createCMS(env).posts.getList()
```
