# notion-headless-cms

Notion をヘッドレス CMS として利用するための TypeScript ライブラリ群。  
Cloudflare Workers + R2 での利用を前提に設計されており、pnpm モノリポで管理されている。

## データフロー

```mermaid
flowchart LR
  notion[(Notion DB)]

  subgraph pipeline["パイプライン（core が統合）"]
    direction LR
    fetcher["fetcher\nAPI 取得"]
    transformer["transformer\nblocks → Markdown"]
    renderer["renderer\nMarkdown → HTML"]
  end

  cache[(R2 / メモリ\nキャッシュ)]
  output["Cloudflare Workers\n/ Node.js スクリプト"]

  notion -->|"blocks"| fetcher
  fetcher --> transformer
  transformer --> renderer
  renderer -->|"HTML"| pipeline
  pipeline <-->|"SWR"| cache
  pipeline --> output
```

> **SWR（Stale-While-Revalidate）**: キャッシュを即返し、TTL 切れなら裏で非同期更新。  
> Notion の `last_edited_time` を比較し、変更があれば HTML を再生成する。

## パッケージ構成

| パッケージ | 役割 |
|---|---|
| [`@notion-headless-cms/core`](./packages/core) | CMS エンジン本体（取得・変換・キャッシュを統合） |
| [`@notion-headless-cms/fetcher`](./packages/fetcher) | Notion API クライアントラッパー |
| [`@notion-headless-cms/transformer`](./packages/transformer) | Notion ブロック → Markdown 変換 |
| [`@notion-headless-cms/renderer`](./packages/renderer) | Markdown → HTML レンダリング（remark/rehype） |
| [`@notion-headless-cms/cache-r2`](./packages/cache-r2) | Cloudflare R2 ストレージアダプター |
| [`@notion-headless-cms/adapter-cloudflare`](./packages/adapter-cloudflare) | Cloudflare Workers 向けファクトリー |

## クイックスタート（Node.js）

Notion トークンとデータベース ID があれば、Node.js スクリプトとして最小構成で動かせる。

### インストール

```bash
npm install @notion-headless-cms/core @notion-headless-cms/source-notion
```

### スクリプト例

```ts
// fetch-posts.ts
import { createCMS } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";

const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  }),
  schema: { publishedStatuses: ["公開"] },
});

// 記事一覧を取得
const posts = await cms.list();
console.log(posts);

// スラッグで HTML を取得
const rendered = await cms.renderBySlug("my-first-post");
console.log(rendered?.html);
```

```bash
NOTION_TOKEN=xxx NOTION_DATA_SOURCE_ID=yyy npx tsx fetch-posts.ts
```

> R2 キャッシュ不要のローカル開発・バッチ処理向け。  
> Cloudflare Workers + R2 を使った本番構成は次節を参照。

## クイックスタート（Cloudflare Workers）

### wrangler.toml

```toml
[[r2_buckets]]
binding = "CACHE_BUCKET"
bucket_name = "my-cms-cache"
```

### Workers エントリーポイント

```typescript
import { createCloudflareCMS } from "@notion-headless-cms/adapter-cloudflare";

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

    if (url.pathname === "/posts") {
      const { items } = await cms.getItems();
      return Response.json(items);
    }

    const slug = url.pathname.replace("/posts/", "");
    const cached = await cms.getItemBySlug(slug);
    if (!cached) return new Response("Not Found", { status: 404 });

    return new Response(cached.html, {
      headers: { "Content-Type": "text/html" },
    });
  },
};
```

### 環境変数

```bash
wrangler secret put NOTION_TOKEN
wrangler secret put NOTION_DATA_SOURCE_ID
```

## 開発

### 必要なツール

- Node.js 22
- pnpm 10

### コマンド

```bash
pnpm install          # 依存関係インストール
pnpm build            # 全パッケージをビルド（tsup）
pnpm typecheck        # 全パッケージの型チェック
pnpm format           # Biome でフォーマット・Lint
```

### 個別パッケージ

```bash
cd packages/core
pnpm build
pnpm typecheck
```

## リリース・公開

npm への公開は CI（`.github/workflows/publish.yml`）が自動処理する。

```bash
# バージョンタグを打つと CI がトリガーされる
git tag v0.2.0
git push origin v0.2.0
```

手動公開も `workflow_dispatch` で実行できる（GitHub Actions の UI から）。

## ライセンス

MIT
