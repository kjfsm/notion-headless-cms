# notion-headless-cms

Notion をヘッドレス CMS として利用するための TypeScript ライブラリ群。  
Cloudflare Workers + R2 での利用を前提に設計されており、pnpm モノリポで管理されている。

## パッケージ構成

| パッケージ | 役割 |
|---|---|
| [`@notion-headless-cms/core`](./packages/core) | CMS エンジン本体（取得・変換・キャッシュを統合） |
| [`@notion-headless-cms/fetcher`](./packages/fetcher) | Notion API クライアントラッパー |
| [`@notion-headless-cms/transformer`](./packages/transformer) | Notion ブロック → Markdown 変換 |
| [`@notion-headless-cms/renderer`](./packages/renderer) | Markdown → HTML レンダリング（remark/rehype） |
| [`@notion-headless-cms/cache-r2`](./packages/cache-r2) | Cloudflare R2 ストレージアダプター |
| [`@notion-headless-cms/adapter-cloudflare`](./packages/adapter-cloudflare) | Cloudflare Workers 向けファクトリー |

## アーキテクチャ

```
Notion DB
  └─ fetcher（API取得）
       └─ transformer（ブロック → Markdown）
            └─ renderer（Markdown → HTML）
                 └─ core / CMS（キャッシュ統合・更新検知）
                      └─ cache-r2（R2 ストレージ）
                           └─ adapter-cloudflare（Workers 注入）
                                └─ Cloudflare Workers → ブラウザ
```

### キャッシュ戦略（Stale-While-Revalidate）

- 初回: Notion から取得してレンダリングし、R2 にキャッシュ
- 以降: キャッシュを即返し、TTL 切れなら裏で非同期更新
- Notion の `last_edited_time` を比較し、変更があれば HTML を再生成

### 画像処理

- Notion 画像 URL は期限付きのため Workers でプロキシ
- SHA256 ハッシュキーで R2 に永続保存（`/api/images/{hash}` で配信）

## インストール

`@notion-headless-cms` スコープは npm 公開リポジトリから公開されている。  
通常の `npm install` で取得できる（追加の認証設定は不要）。

Cloudflare Workers プロジェクトで利用する場合はアダプターをインストールする。

```bash
npm install @notion-headless-cms/adapter-cloudflare
```

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
      const { items } = await cms.getItems(env);
      return Response.json(items);
    }

    const slug = url.pathname.replace("/posts/", "");
    const cached = await cms.getItemBySlug(slug, env);
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
