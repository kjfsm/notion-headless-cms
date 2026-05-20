# example-minimal-node

README 冒頭「30 秒で動かす」のコードを **1 ファイル / 30 行以内** で動かす最小サンプル。

## セットアップ

```bash
# 1. このリポジトリのルートで
pnpm install

# 2. このディレクトリで
cd examples/minimal-node
echo "NOTION_TOKEN=ntn_xxxxx" > .env
echo "DB_NAME=ブログ記事DB" >> .env  # 任意

# 3. スキーマ生成 (Notion DB を introspect)
pnpm generate

# 4. 実行
pnpm start
```

## 構成

| ファイル | 役割 |
|---|---|
| `nhc.config.ts` | `nhc generate` の設定（DB 名・公開ステータス） |
| `src/index.ts` | `createClient` → `cms.posts.list()` → console.log（30 行以内） |
| `src/generated/nhc.ts` | `nhc generate` の出力（コミット対象） |

## 自分のプロジェクトに移植する

このディレクトリの `package.json` の `dependencies` を `npm install` し、`src/index.ts` を `app/lib/cms.ts` 等に展開すれば移植完了。Next.js / Cloudflare へ移すときは [`examples/vercel-nextjs`](../vercel-nextjs/) や [`examples/cloudflare-hono`](../cloudflare-hono/) を参照。
