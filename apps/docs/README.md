# @notion-headless-cms/docs

`notion-headless-cms` 公式ドキュメントサイト。**dogfooding として本ライブラリ自身**で構築されている。

- `/` ・ `/:slug` … Notion 固定ページDB から `@notion-headless-cms/cloudflare` 経由で配信（ランディング + about / showcase / privacy 等）
- `/docs` ・ `/docs/*` … リポジトリ直下 `docs/ja/**/*.md` を直接静的レンダリング（unified + remark + rehype-shiki）
- `/api/images/:hash` … Notion 画像プロキシ（R2 キャッシュ）
- `/api/pages/:slug/check` … クライアント側ポーリングで Notion ページの最終更新を確認
- `/api/revalidate` … Notion Webhook 受信（HMAC-SHA256 署名検証）

技術スタック: Cloudflare Workers + React Router v7 + Vite + Tailwind v4 / shadcn

## ローカル開発

```bash
# 1. リポジトリルートで依存を入れる
pnpm install

# 2. apps/docs/.dev.vars に NOTION_TOKEN（任意で NOTION_WEBHOOK_SECRET）を書く
cp apps/docs/.dev.vars.example apps/docs/.dev.vars
$EDITOR apps/docs/.dev.vars

# 3. ワークスペースをビルド（packages/*）
pnpm build

# 4. Notion DB からスキーマを再生成
pnpm --filter @notion-headless-cms/docs generate

# 5. dev server 起動
pnpm --filter @notion-headless-cms/docs dev
```

## デプロイ: Cloudflare GitHub App (Workers Builds)

本サイトは **GitHub Actions ではなく Cloudflare GitHub App (Workers Builds) で自動デプロイ**する。リポジトリのトリガは Cloudflare 側に一本化し、ワークフローの二重起動を避ける。

### 初回セットアップ

1. **Cloudflare ダッシュボードでアプリを作成**
   - Workers & Pages → Create application → Workers → "Import a repository"
   - GitHub App をインストールし、`kjfsm/notion-headless-cms` を選択（既に他 example で連携済みなら追加権限のみ）

2. **ビルド設定**（ダッシュボードの "Build configuration"）

   | 項目 | 値 |
   |---|---|
   | Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm build && pnpm --filter @notion-headless-cms/docs generate && pnpm --filter @notion-headless-cms/docs build` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | `apps/docs` |
   | Node.js version | `24` |
   | Build watch paths | `apps/docs/**` / `docs/**` / `packages/**` / `pnpm-workspace.yaml` / `pnpm-lock.yaml`（任意） |

   Workers Builds の "Root directory" は `wrangler deploy` を実行する場所。`build` / `generate` コマンドはモノレポ上で `pnpm --filter` を使うためルートからの相対指定でも問題ない（pnpm が Root directory より上のワークスペースを認識する）。

3. **環境変数とシークレット**（ダッシュボードの "Variables and Secrets"）

   | 名前 | 種別 | 用途 |
   |---|---|---|
   | `NOTION_TOKEN` | Secret | `nhc generate` と Notion API ランタイム呼び出し |
   | `NOTION_WEBHOOK_SECRET` | Secret | `/api/revalidate` の署名検証（任意） |

   `NOTION_TOKEN` は **Build / Runtime 両方** で必要なので "Build" と "Runtime" の両側に登録すること。

4. **バインディング**（ダッシュボードの "Bindings"、もしくは `wrangler.toml`）

   | バインディング | 種別 | 値 |
   |---|---|---|
   | `IMG_BUCKET` | R2 | `nhc-docs-site-cache`（事前作成: `wrangler r2 bucket create nhc-docs-site-cache`） |
   | `DOC_CACHE` | KV | `wrangler kv namespace create DOC_CACHE` で作成した namespace ID を `wrangler.toml` に記入 |

5. **ブランチ設定**
   - Production branch: `main`
   - Preview deployments: `Enabled`（PR ごとに preview URL が払い出される）

### デプロイ後

- 本番: `main` への push で自動デプロイ
- プレビュー: PR push で `*.workers.dev` の preview URL が PR コメントとして付与される（Workers Builds の挙動）
- 再ビルド: ダッシュボードの "Re-run build" から手動再実行可

### Notion Webhook 連携

`/api/revalidate` を使う場合のみ:

1. Notion インテグレーション設定で Webhook を作成し、URL に `https://<deployed-domain>/api/revalidate` を指定
2. Notion 側で発行された secret を Cloudflare ダッシュボードの `NOTION_WEBHOOK_SECRET` (Runtime Secret) に登録
3. Notion 側で対象 DB を Webhook subscription に追加

Webhook は HMAC-SHA256 (`x-notion-signature` ヘッダ) で署名検証され、不一致なら 401 を返す。

## ライブラリ本体のドキュメント追加

`/docs/*` で配信されるのは `docs/ja/**/*.md`。md ファイル先頭の frontmatter で表示制御する:

```yaml
---
title: クイックスタート
description: 5 分で notion-headless-cms を動かす
category: はじめに
order: 1
---
```

`category` は `はじめに` / `ガイド` / `APIリファレンス` / `レシピ` のいずれかを推奨（サイドバー並び順を `app/components/layout/DocsSidebar.tsx` の `SECTION_ORDER` で制御）。未知の category は末尾に追加される。

英語追加時は `docs/en/...` を作り、`apps/docs/app/lib/i18n/config.ts` の `locales = ["ja", "en"] as const` に変更するだけで `/docs/en/...` が解決される。
