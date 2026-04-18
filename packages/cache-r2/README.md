# @notion-headless-cms/cache-r2

Cloudflare R2 ストレージアダプター。`StorageAdapter` インターフェースの R2 実装。

## インストール

```bash
npm install @notion-headless-cms/cache-r2
```

Cloudflare Workers 環境では [`@notion-headless-cms/adapter-cloudflare`](../adapter-cloudflare) を使うと  
このパッケージを直接インストールせずに済む。

## 使い方

```typescript
import { createCloudflareR2StorageAdapter } from "@notion-headless-cms/cache-r2";
import { CMS } from "@notion-headless-cms/core";

// Workers の fetch ハンドラー内
const storage = createCloudflareR2StorageAdapter(env.CACHE_BUCKET);

const cms = new CMS({ storage });
```

`R2Bucket` が `undefined` の場合（`CACHE_BUCKET` 未バインド）は、キャッシュなしアダプターを返す。

## API

### `createCloudflareR2StorageAdapter(bucket?)`

| 引数 | 型 | 説明 |
|---|---|---|
| `bucket` | `R2Bucket \| undefined` | Cloudflare R2 バインディング |

戻り値: `StorageAdapter`（`@notion-headless-cms/core`）

`bucket` が `undefined` のとき、すべての `get` が `null` を返し `put` は何もしない no-op アダプターを返す。

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — `StorageAdapter` インターフェース定義
- [`@notion-headless-cms/adapter-cloudflare`](../adapter-cloudflare) — このパッケージを内部で使用する Workers ファクトリー
