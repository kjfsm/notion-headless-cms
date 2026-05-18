---
name: affected
description: origin/main からの diff に影響するパッケージだけを turbo の依存グラフ越しに typecheck + test する。CLAUDE.md の「変更後は pnpm typecheck && pnpm test」を高速化する。明示呼び出し限定
disable-model-invocation: true
allowed-tools:
  - Bash(pnpm exec turbo:*)
  - Bash(git fetch:*)
  - Bash(git merge-base:*)
  - Bash(git rev-parse:*)
---

# /affected — 変更パッケージのみ検証

## 目的

CLAUDE.md 絶対ルール「変更後は必ず `pnpm typecheck && pnpm test`」を、turbo の `--filter="...[<base>]"` で**影響パッケージだけ**に絞って実行する。
turbo cache が効くため通常 CI より大幅に高速、トークン消費も少ない（`outputLogs: errors-only` が `turbo.json` で既設定）。

## 使い方

### 基本（基準: `origin/main`）

```bash
git fetch origin main --quiet
pnpm exec turbo run typecheck test --filter="...[origin/main]"
```

### パッケージを明示

```bash
pnpm exec turbo run typecheck test --filter="@notion-headless-cms/core..."
```

末尾 `...` で「そのパッケージと依存先」を含める。逆向き（依存元）は `...^` を付ける。

### 基準ブランチ変更（例: `main` 派生 PR 以外）

```bash
BASE=$(git merge-base HEAD origin/main)
pnpm exec turbo run typecheck test --filter="...[$BASE]"
```

## いつ使うか

- 1〜2 パッケージを編集して typecheck/test を走らせたい時（**第一選択**）
- PR 着手前のセルフチェック

## いつ使わないか

- `packages/core` のような被依存数が多い箇所を触った後 → 結局ほぼ全パッケージが対象になる。素直に `pnpm verify` を使う
- リリース前最終チェック → `/publish-preflight` を使う

## 失敗時

turbo の出力（`errors-only`）に従ってエラー箇所だけ Read で確認する。全ログを再実行する必要は基本ない。
