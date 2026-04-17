# @kjfsm/notion-headless-cms-adapter-cloudflare

Cloudflare Workers 向け CMS ファクトリー。  
`env.CACHE_BUCKET`（R2Bucket）を受け取り、`CMS` インスタンスを生成して返す。

## インストール

```bash
npm install @kjfsm/notion-headless-cms-adapter-cloudflare
```

`.npmrc` に以下を追加する（GitHub Packages 認証）:

```
@kjfsm:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

## 使い方

### wrangler.toml

```toml
[[r2_buckets]]
binding = "CACHE_BUCKET"
bucket_name = "my-cms-cache"
```

### Workers エントリーポイント

```typescript
import { createCloudflareCMS } from "@kjfsm/notion-headless-cms-adapter-cloudflare";

interface Env {
  NOTION_TOKEN: string;
  NOTION_DATA_SOURCE_ID: string;
  CACHE_BUCKET?: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cms = createCloudflareCMS(env, {
      schema: {
        publishedStatuses: ["公開"],
        accessibleStatuses: ["公開", "下書き"],
      },
      cache: { ttlMs: 5 * 60 * 1000 },
    });

    const url = new URL(request.url);

    // コンテンツ一覧
    if (url.pathname === "/posts") {
      const { items } = await cms.getItems(env);
      return Response.json(items);
    }

    // 個別コンテンツ
    const slug = url.pathname.replace("/posts/", "");
    const cached = await cms.getItemBySlug(slug, env);
    if (!cached) return new Response("Not Found", { status: 404 });

    return new Response(cached.html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
```

### 環境変数の設定

```bash
wrangler secret put NOTION_TOKEN
wrangler secret put NOTION_DATA_SOURCE_ID
```

`CACHE_BUCKET` が未設定の場合はキャッシュなしで動作する（ローカル開発向け）。

## API

### `createCloudflareCMS(env, config?)`

| 引数 | 型 | 説明 |
|---|---|---|
| `env` | `CloudflareCMSEnv` | Workers バインディング（`NOTION_TOKEN`, `NOTION_DATA_SOURCE_ID`, オプションで `CACHE_BUCKET`） |
| `config` | `Omit<CMSConfig, "storage">` | CMS の設定（`schema`, `cache`, `transformer`, `renderer`） |

戻り値: `CMS`（`@kjfsm/notion-headless-cms-core`）

## 関連パッケージ

- [`@kjfsm/notion-headless-cms-core`](../core) — CMS エンジン本体
- [`@kjfsm/notion-headless-cms-cache-r2`](../cache-r2) — R2 ストレージアダプター（内部で使用）
