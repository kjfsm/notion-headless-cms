# 開発者ガイド

このリポジトリで開発するために**一度だけ実行が必要な操作**をまとめる。コピペで実行できるコマンド付き。

> コードベースの設計は [`README.md`](../README.md) と [`CLAUDE.md`](../CLAUDE.md)、個別の規約は [`.claude/rules/`](../.claude/rules/) を参照。

## 1. ローカル開発環境

### 必要なツール

| ツール | バージョン | 備考 |
|---|---|---|
| Node.js | `>=24` | 全パッケージの `engines.node` |
| pnpm | `10.x` | `package.json` の `packageManager` に固定 |
| git | 任意 | |

### 初回セットアップ

```bash
git clone https://github.com/kjfsm/notion-headless-cms.git
cd notion-headless-cms
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

## 2. Claude Code で開発する場合

このリポジトリには Claude Code 用の拡張資産（`.claude/rules/`, `.claude/skills/`, `.claude/agents/`, `.claude/hooks/`, `.claude/settings.json`）が同梱されている。

### 初期化

リポジトリを clone した時点で `.claude/` は git 管理下にあるため追加設定は原則不要。以下のみ確認する。

```bash
# hooks の実行権限を確認（clone 直後に実行を推奨）
ls -la .claude/hooks/*.sh

# -rwxr-xr-x になっていない場合は付与
chmod +x .claude/hooks/*.sh
```

### 個人設定の上書き（任意）

プロジェクト設定を**上書き**したい場合は `.claude/settings.local.json` を作る（`.gitignore` 済み）。

```bash
cp .claude/settings.json .claude/settings.local.json
# 編集する
```

### 推奨 MCP サーバー登録

Claude Code 経由で Notion / Cloudflare / ライブラリドキュメントを高速参照できる。**各コントリビューターが自分の環境で一度だけ実行する**。

```bash
# Notion MCP — DB スキーマ確認・ブロック取得のデバッグに使う
claude mcp add notion --env NOTION_TOKEN=<your_token> -- npx -y @notionhq/notion-mcp-server

# Cloudflare Docs MCP — Workers/R2/KV の最新仕様参照
claude mcp add --transport http cloudflare-docs https://docs.mcp.cloudflare.com/mcp

# Context7 — unified/remark/rehype/zod 等の最新ドキュメント参照
claude mcp add --transport http context7 https://mcp.context7.com/mcp
```

確認:

```bash
# Claude Code 内で
/mcp
```

### 推奨 Plugin

```bash
# Claude Code 内で
/plugin install anthropics/code-intelligence
```

大規模モノレポでのシンボル解決・参照追跡が強化され、探索トークンを節約できる。

## 3. GitHub リポジトリ管理者向け設定

以下はリポジトリ管理者が**一度だけ**実行する。

### 3-1. Secrets 登録

| Secret | 必須 | 取得元 |
|---|---|---|
| `NPM_TOKEN` | 必須 | npm アカウントで **Automation** トークンを発行 |
| `NOTION_TOKEN` | examples の CI smoke test で使う場合のみ | Notion インテグレーション |

```bash
gh secret set NPM_TOKEN --body "<npm automation token>"
gh secret set NOTION_TOKEN --body "<notion integration token>"
```

> `GITHUB_TOKEN` は GitHub Actions が自動付与するため登録不要。

### 3-2. npm 側の設定

- npm で **2FA automation token** を使う（通常の publish token では provenance が付けられない）
- `packages/*/package.json` の `publishConfig.access: "public"` が設定されていること（新パッケージ追加時に特に注意）
- `release.yml` の `id-token: write` と `NPM_CONFIG_PROVENANCE=true` で provenance 有効化済み

### 3-3. Branch Protection（main）

必須の CI チェックを main にかける:

```bash
gh api -X PUT "repos/kjfsm/notion-headless-cms/branches/main/protection" \
  -F required_status_checks.strict=true \
  -F required_status_checks.contexts='["lint","build-test","changeset-check","publint"]' \
  -F enforce_admins=true \
  -F required_pull_request_reviews.required_approving_review_count=1 \
  -F restrictions=
```

### 3-4. GitHub Actions 権限

- Settings → Actions → General → **Workflow permissions**: 「Read and write permissions」に設定
- Settings → Actions → General → **Allow GitHub Actions to create and approve pull requests**: ON
  - changesets が「Version Packages」PR を自動作成するのに必要

### 3-5. Dependabot グループ化（任意）

既存の `.github/dependabot.yml` を編集して PR 数を抑制できる。

## 4. Cloudflare examples の動作確認

`examples/cloudflare-*` を動かす場合、各ディレクトリで以下を実行する。

```bash
cd examples/cloudflare-hono  # 例

# ローカル開発
cp .dev.vars.example .dev.vars 2>/dev/null || true
# .dev.vars に NOTION_TOKEN を記述（.gitignore 済み）
echo 'NOTION_TOKEN = "ntn_xxxxxxxxxxxx"' > .dev.vars

# R2 バケットをローカル作成（任意、デプロイ時に必須）
npx wrangler r2 bucket create nhc-example-cache

# Workers 型定義生成
npx wrangler types

# スキーマ生成
pnpm nhc generate

# 起動
npx wrangler dev
```

本番デプロイ時:

```bash
npx wrangler secret put NOTION_TOKEN
npx wrangler deploy
```

## 5. CLI (`nhc`) のローカル確認

```bash
# テンプレ生成
pnpm --filter @notion-headless-cms/cli run build
node packages/cli/dist/index.js init

# スキーマ生成（NOTION_TOKEN 必要）
NOTION_TOKEN=xxx node packages/cli/dist/index.js generate
```

## 6. 日常の開発フロー

```bash
# 1. ブランチ作成
git switch -c feat/<topic>

# 2. 変更を加える（Claude Code がhooksで自動整形）
# 3. 必ず通す
pnpm typecheck && pnpm test && pnpm format

# 4. changeset 作成（packages/* を触った場合）
pnpm changeset

# 5. コミット・プッシュ
git add .
git commit -m "<日本語で変更理由>"
git push -u origin feat/<topic>

# 6. PR 作成（テンプレが自動適用される）
gh pr create
```

詳細: [`CLAUDE.md`](../CLAUDE.md) の「作業フロー」セクション。

## 7. リリース（管理者のみ）

手動操作は原則**不要**。main にマージすると:

1. `release.yml` が起動
2. 保留中 changeset があれば `Version Packages` PR を自動作成
3. その PR をマージすると npm に自動公開

トラブル時の診断は `.claude/skills/release/SKILL.md` を参照。

## 8. CI ワークフロー一覧

| ワークフロー | トリガー | 内容 |
|---|---|---|
| `ci.yml` | PR / main push | lint + build + typecheck + test |
| `release.yml` | main push | changesets/action による Version PR 作成・npm 公開 |
| `changeset-check.yml` | PR | packages/ 変更時に changeset 有無を検証 |
| `publint.yml` | PR (packages/ 変更時) | publint + are-the-types-wrong |
| `codeql.yml` | PR / main / 毎週月曜 | セキュリティスキャン |
| `dependency-review.yml` | PR | 依存の脆弱性・ライセンスチェック |

`skip-changeset` ラベルを PR に付けると `changeset-check` をスキップできる（docs のみ変更などで使う）。
