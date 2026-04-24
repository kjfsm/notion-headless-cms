# CLAUDE.md

Notion をヘッドレス CMS として利用する TypeScript ライブラリ群のモノレポ。
npm スコープ `@notion-headless-cms/*` で公開。

## 絶対ルール

1. **言語**: コメント・コミットメッセージ・PR 概要はすべて**日本語**
2. **変更後**: 必ず `pnpm typecheck && pnpm test`。失敗を残したままコミットしない
3. **core はゼロ依存**: `packages/core` は `@notionhq/client` / `unified` / `zod` / `@notion-headless-cms/renderer` に静的 import で依存しない（詳細: `.claude/rules/core.md`）
4. **シークレット**: コードにハードコードしない。環境変数 / `wrangler secret` / `env()` ヘルパー経由（詳細: `.claude/rules/secrets.md`）
5. **`.claude/` の編集は `.claude-next/` で作業してから一括コピー**する（本セッション中の反映事故を避け、差分レビューしやすくするため）

## 詳細ドキュメントの場所

- 全体構成・セットアップ: `README.md`
- ワークスペース構成: `pnpm-workspace.yaml`
- パッケージ固有ルール: `.claude/rules/<area>.md`（`paths:` 指定で該当パス編集時のみ自動注入）
- 手順・ワークフロー: `.claude/skills/<name>/SKILL.md`（`/<name>` で明示呼び出し）
- 設計背景: `docs/architecture.md`
- マイグレーション: `docs/migration/README.md`

## 共通コマンド

- `pnpm build` / `pnpm typecheck` / `pnpm test` / `pnpm format` / `pnpm lint`
- `pnpm changeset` — changeset 作成（`/changeset-flow` で補助）
- 個別: `pnpm --filter @notion-headless-cms/<pkg> <script>`

## `.claude/` 編集フロー

```bash
# 1. 作業フォルダを用意（最初だけ）
cp -r .claude .claude-next

# 2. .claude-next/ 配下で編集
$EDITOR .claude-next/rules/xxx.md

# 3. diff を確認
diff -r .claude .claude-next

# 4. 問題なければ一括コピー
rsync -a --delete .claude-next/ .claude/
# または: rm -rf .claude && cp -r .claude-next .claude
```

- `.claude-next/` は `.gitignore` に追加しておくか、コピー後に削除する
- 本セッションからは **`.claude/` への直接書き込みを避ける**

## リリース

main マージで `release.yml` が "Version Packages" PR を作成。その PR をマージすると npm に公開される。

## 自己更新ルール

同じ指摘を 2 回以上受けた事項は以下の優先順位でドキュメントに追記する:

1. **パス固有の事実** → `.claude/rules/<area>.md`
2. **手順・テンプレ・ワークフロー** → `.claude/skills/<name>/SKILL.md`
3. **全セッションで必要な絶対ルール** → この `CLAUDE.md`
