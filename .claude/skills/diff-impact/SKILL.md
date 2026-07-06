---
name: diff-impact
description: 現在の git diff から影響パッケージ・推奨 changeset bump・走らせるべき検証コマンド・関連 rules を 1 回で算出する。PR 着手やレビュー前の状況把握を集約しトークン消費を抑える
disable-model-invocation: true
allowed-tools:
  - Bash(git diff:*)
  - Bash(git fetch:*)
  - Bash(git status:*)
  - Bash(git merge-base:*)
  - Bash(pnpm exec turbo:*)
  - Bash(ls .changeset:*)
  - Read
---

# /diff-impact — 差分から影響範囲を一括算出

## 目的

「いまの差分」に対して**何を確認・実行すべきか**を 1 回の skill 呼び出しでまとめる。
個別に diff・package 抽出・changeset 確認・rule 検索を行うとツール呼び出しが嵩むため、それを集約する。

## 手順

### 1. 基準コミットを決定

```bash
git fetch origin main --quiet
BASE=$(git merge-base HEAD origin/main)
```

### 2. 変更ファイル一覧

```bash
git diff --name-only "$BASE"...HEAD
git status --short  # 未コミットも含める
```

### 3. 影響パッケージ抽出

ファイルパスの先頭 `packages/<x>/` を集計し、`@notion-headless-cms/<x>` の一覧にする。
`packages/*/src/internal/**` の変更は公開 API 変更ではないことを注記。

### 4. turbo の依存伝播を裏取り

```bash
pnpm exec turbo run typecheck --filter="...[$BASE]" --dry-run=json \
  | jq '.tasks[].package' | sort -u
```

ステップ 3 の素朴集計と差があれば、依存伝播で連動する被依存パッケージを補足する。

### 5. changeset の有無

```bash
ls .changeset/*.md 2>/dev/null | grep -v README
```

影響パッケージごとに changeset があるか確認。無いものは要追加。
**bump 種別は CLAUDE.md §6 に従い既定 `patch`**（`major` / `minor` はユーザー指示があった時のみ）。

### 6. 関連 rule

`.claude/rules/` のうち、影響パッケージに対応するものを列挙:

- `packages/cms/**` → `cms.md` / `package-boundaries.md`
- `packages/cms/**`（Cloudflare 関連ファイル）/ `examples/cloudflare-*/**` → `cloudflare.md`
- `packages/cli/**` → `cli.md`
- `packages/react-renderer/**` → `package-boundaries.md`
- `packages/**/__tests__/**` → `testing.md`
- エラーコード追加時 → `error-handling.md`

## 出力形式

Markdown テーブル 1 枚:

| パッケージ                          | 直接変更 | 依存伝播 | changeset | 推奨 bump | 関連 rule                      |
| ----------------------------------- | -------- | -------- | --------- | --------- | ------------------------------ |
| @notion-headless-cms/cms            | ✅       | —        | ❌        | patch     | cms.md / package-boundaries.md |
| @notion-headless-cms/react-renderer | —        | ✅       | —         | —         | package-boundaries.md          |

末尾に**次アクション**を 3〜5 行で提示:

- `/affected` で検証
- `/changeset-flow` で changeset 追加
- リリース直前なら `/publish-preflight`

## いつ使わないか

- diff が単一ファイル・1 パッケージ完結 → 直接 `/affected` で十分
- すでに PR 作成済みで CI が回っている → CI 結果を見るほうが正確
