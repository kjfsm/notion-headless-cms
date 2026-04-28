---
"@notion-headless-cms/notion-embed": minor
"@notion-headless-cms/cache": minor
"@notion-headless-cms/notion-orm": minor
"@notion-headless-cms/core": minor
---

コード予測可能性向上 PR 4: notion-orm / notion-embed / cache 整理

- **notion-embed**: `fetchOgp` をキャッシュなし純粋関数に変更。HTTP エラー時は Error を投げる (旧: `console.warn + return {}`)。TTL キャッシュが必要な場合は新設の `createOgpFetcher()` ファクトリを使う。インスタンス間でキャッシュを共有しない
- **notion-embed**: `fetchOembed` の HTTP エラー時も Error を投げる (旧: `console.warn + return {}`)
- **notion-embed**: `clearOgpCache()` を削除 (キャッシュがスコープ化されたため不要)
- **notion-embed**: `extractUrlFromMarkdownLink` / `addHttpsToProtocolRelative` / `isHttpUrl` を公開 API として export
- **cache**: `cloudflareCache(env, opts)` のシグネチャを `cloudflareCache(bindings, opts)` に変更。`bindings.docCache` / `bindings.imgBucket` に KV / R2 の binding インスタンスを直接渡す (旧: env オブジェクト + binding 名文字列)
- **notion-orm**: `getPlainText()` の戻り値型を `string | null` に統一 (旧: 空文字列を返すケースがあった)
- **notion-orm / core**: `isArchived` を `archived` フラグのみに変更し `isInTrash` を独立フィールドとして追加 (旧: `isArchived = in_trash || archived` で 2 フラグを混合)
- **core**: `buildCacheImageFn` の `hashMemo` をモジュール変数からファクトリスコープローカルに変更。インスタンス間でメモを共有しない
