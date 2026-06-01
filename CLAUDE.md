# CLAUDE.md

Notion をヘッドレス CMS として利用する TypeScript ライブラリ群の pnpm モノレポ（npm スコープ `@notion-headless-cms/*`）。
このリポジトリの詳細・設計方針・コマンドは **`.claude/project.md`** を参照（作業開始時に必ず読む）。

> コンパクション時: 変更中ファイル一覧・実行すべきテストコマンド・タスク状態を必ず保持すること。

---

## 絶対ルール

スタックに依存しない最優先ルール。全リポジトリで同一文面。

1. **言語**: コメント・コミットメッセージ・PR タイトル・PR 概要・AI とのやり取りはすべて**日本語**。ブランチ名は英語のみ（日本語禁止）。識別子・型名・ログ・JSX 表示テキストは英語のまま触らない。
2. **変更後は必ず `typecheck` と関連テストを通す**。失敗を残したままコミットしない。
3. **`main` への直 push 禁止**。必ずブランチを切って PR を出す。
4. **シークレットをコード／Git にハードコードしない**。`.dev.vars` / `.env` は commit せず、ログにも出さない。
5. **pre-commit / pre-deploy フックを `--no-verify`（`--no-gpg-sign` 等）でスキップしない**。フックが落ちたら根本原因（型・lint・テスト）を直す。
6. **自動生成ファイルを手編集しない**（具体パスは `.claude/project.md` を参照）。

---

## このリポジトリ固有の絶対ルール

1. **`packages/core` はゼロ依存**: `@notionhq/client` / `unified` / `zod` / `@notion-headless-cms/renderer` に静的 import で依存しない（詳細: `.claude/rules/core.md`）。
2. **`.claude/` の編集は `.claude-next/` で作業してから一括コピー**する（手順: `.claude/project.md` の「`.claude/` 編集フロー」）。
3. **changeset の bump 種別**: 明示的な指示がない限り **`patch`** を使う（`major` / `minor` は指示があった場合のみ）。
4. **shadcn 生成ファイル (`**/components/ui/**`) は手編集せず再生成**する（`pnpm dlx shadcn@latest add <component> --overwrite`）。

---

## 参照先（索引）

- **プロジェクト固有の詳細**（設計方針・パッケージ構成・全コマンド・編集フロー・リリース）→ **`.claude/project.md`**
- **パッケージ別の詳細規約**（編集対象のパスに応じて自動注入）→ **`.claude/rules/`**
- **手順・ワークフロー**（`/<name>` で明示呼び出し）→ **`.claude/skills/`**
- **設計背景** → **`docs/ja/architecture.md`**

---

## 自己更新ルール

同じ指摘を 2 回以上受けた事項は、以下の優先順位でドキュメントに追記する。

1. **パス固有の事実** → `.claude/rules/<area>.md`（`paths:` 指定で該当パス編集時のみ自動注入）
2. **手順・テンプレ・ワークフロー** → `.claude/skills/<name>/SKILL.md`（`/<name>` で明示呼び出し）
3. **決定的に弾きたい挙動** → `.claude/hooks/*.sh`（PreToolUse 等で 100% 実行）
4. **全セッションで必要な絶対ルール** → この `CLAUDE.md` ／ **プロジェクト固有の常識** → `.claude/project.md`
