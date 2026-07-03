# example-minimal-node

README 冒頭「30 秒で動かす」のコードを **1 ファイル / 30 行以内** で動かす最小サンプル（v3: `@notion-headless-cms/cms`）。

## セットアップ

```bash
# 1. このリポジトリのルートで
pnpm install

# 2. このディレクトリで
cd examples/minimal-node
echo "NOTION_TOKEN=ntn_xxxxx" > .env

# 3. 実行
pnpm start
```

## 構成

| ファイル | 役割 |
|---|---|
| `src/schema.ts` | `defineCollection`/`defineSchema` によるスキーマ定義（TS ファースト。codegen なし） |
| `src/index.ts` | `createCMS` → 同期 → `cms.posts.list()` → console.log（30 行以内） |

v3 では `nhc generate` によるコード生成は廃止された。`nhc pull` は Notion DB から `defineCollection` の雛形を**一度だけ**生成する補助コマンドで、以降は `src/schema.ts` を直接編集して育てる（詳細: [`docs/ja/cli.md`](../../docs/ja/cli.md)）。このサンプルでは `src/schema.ts` を直接手書きしている。

## 自分のプロジェクトに移植する

このディレクトリの `package.json` の `dependencies` を `npm install` し、`src/schema.ts` / `src/index.ts` を `app/lib/cms.ts` 等に展開すれば移植完了。Next.js / Cloudflare へ移すときは [`examples/vercel-nextjs`](../vercel-nextjs/) や [`examples/cloudflare-hono`](../cloudflare-hono/) を参照。
