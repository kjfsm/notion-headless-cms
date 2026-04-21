---
"@notion-headless-cms/core": patch
"@notion-headless-cms/renderer": patch
"@notion-headless-cms/source-notion": patch
"@notion-headless-cms/cache-r2": patch
"@notion-headless-cms/cache-next": patch
"@notion-headless-cms/adapter-cloudflare": patch
"@notion-headless-cms/adapter-next": patch
"@notion-headless-cms/adapter-node": patch
---

フォールバック・型の握りつぶし・空文字列の黙殺を解消し、型安全性と壊れにくさを向上させる。

- core と renderer の `RendererFn` / `RenderOptions` 型を構造的に互換にし、各アダプターから `as unknown as RendererFn` キャストを排除
- `cacheImage` の戻り値型を `Promise<string | null>` → `Promise<string>` に統一（renderer 実装は null を返さないため）
- プラグイン型を `unknown[]` → `readonly unknown[]` に変更し、副作用的な変更を防ぐ
- `fetchAndCacheImage` が HTTP 失敗を黙殺していたため、`CMSError` を投げるように修正
- `prefetchAll` の `catch` が失敗件数だけカウントして原因を捨てていたため、`logger.warn` で slug / pageId / エラー内容を記録するように修正
- `loadDefaultRenderer` のエラーから `cause` を失っていたため保持するように修正
- `createNodeCMS` の環境変数不足時に素の `Error` を投げていたのを `CMSError` 化（コード: `core/config_invalid`）
- `source-notion/schema.ts` の `select` パースで空文字列 → null の二重フォールバックを廃止し、直接 null を返すよう単純化
- `source-notion/mapper.ts` の slug に `z.string().min(1)` を追加し、空スラッグを Zod で早期に弾く
