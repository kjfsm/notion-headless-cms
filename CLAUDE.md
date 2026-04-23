# CLAUDE.md

Notion をヘッドレス CMS として利用する TypeScript ライブラリ群のモノレポ。
npm スコープ `@notion-headless-cms/*` で公開。

> 詳細なディレクトリ構成は `@README.md` と `@pnpm-workspace.yaml` を参照。個別パッケージの設計は `packages/*/README.md` と `.claude/rules/` を参照。

## 絶対ルール

1. **言語**: コメント・コミットメッセージ・PR 概要はすべて**日本語**
2. **変更後**: 必ず `pnpm typecheck && pnpm test`。失敗を残したままコミットしない
3. **core はゼロ依存**: `packages/core` は `@notionhq/client` / `unified` / `zod` / `@notion-headless-cms/renderer` に**静的 import で依存しない**（詳細: `@.claude/rules/core.md`）
4. **シークレット**: コードにハードコードしない。環境変数 / `wrangler secret` / `env()` ヘルパー経由で渡す

## 不変ルールの参照先（@import）

以下はセッション起動時に読み込まれる。

- `@.claude/rules/coding-style.md` — Biome / ES Modules / 書式
- `@.claude/rules/package-boundaries.md` — 依存方向 / internal / peerDeps
- `@.claude/rules/error-handling.md` — `CMSError` / 名前空間
- `@.claude/rules/secrets.md` — NOTION_TOKEN / env()

パス固有ルールは `.claude/rules/` 配下で `paths:` frontmatter 付き。該当パスを触る時に自動で注入される（`core.md` / `source-notion.md` / `cache.md` / `adapter.md` / `cli.md` / `docs.md` / `examples.md`）。

## 作業フロー

1. **実装前**: Plan Mode で関連ファイルを確認
2. **実装中**: 既存の skill が該当すれば `/skill-name` で呼ぶ（`/changeset-flow`, `/new-package`, `/publish-preflight` など）
3. **実装後**: `pnpm typecheck && pnpm test && pnpm format` を通してからコミット
4. **changeset**: `packages/*` を触ったら `pnpm changeset` を実行（詳細: `.claude/skills/changeset-flow/`）
5. **ドキュメント追従**: 公開 API を変えたら `docs/` と `packages/*/README.md` を同じコミットで更新（詳細: `.claude/rules/docs.md`）
6. **リリース**: main マージで `release.yml` が "Version Packages" PR を作成。その PR をマージすると npm に公開される

## 自己更新ルール

同じ指摘を 2 回以上受けた事項は、明示的な指示が無くてもドキュメントに追記する。ただし追記先は以下の優先順位で判断する：

1. **パス固有の事実** → `.claude/rules/<area>.md` に追記
2. **手順・テンプレ・ワークフロー** → `.claude/skills/<name>/SKILL.md` に追記
3. **全セッションで必要な絶対ルール** → この CLAUDE.md に追記

CLAUDE.md はプロジェクト全体で必ず守るべき最小限のルールのみを保持する。詳細知識は `.claude/rules/` と `.claude/skills/`、`docs/` に置くこと。

## 共通コマンド

- `pnpm build` / `pnpm typecheck` / `pnpm test` / `pnpm format` / `pnpm lint`
- `pnpm changeset` — changeset 作成
- 個別: `pnpm --filter @notion-headless-cms/<pkg> <script>`

## Cloudflare Workers

Workers / R2 / D1 / KV を扱う場合は `.claude/skills/cloudflare-workers/` を参照。最新の仕様は常に Cloudflare Docs MCP で取得する。
