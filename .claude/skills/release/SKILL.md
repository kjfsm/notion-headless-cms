---
name: release
description: npm 公開前のリリース前チェックと手順。副作用があるためモデルからの自動呼び出しを無効化する。明示的に /release と指示された時のみ使う
disable-model-invocation: true
---

# /release — リリース手順

## 前提

このリポジトリは **changesets/action で自動リリース**される。通常は `main` にマージすると:

1. `release.yml` が起動
2. 保留中 changeset があれば `Version Packages` PR を自動作成
3. その PR をマージすると npm に自動公開（provenance 付き）

手動操作は原則不要。以下は**トラブル時の診断**と**リリース前レビュー**の手順。

## リリース前チェックリスト

### 1. changeset の確認

```bash
pnpm changeset status --since=origin/main
```

- 期待される bump が出ているか
- 意図しないパッケージが含まれていないか

### 2. ビルド・型・テスト

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
```

### 3. 公開物の検査（publint + attw）

```bash
pnpm -r --filter "./packages/*" exec publint
pnpm -r --filter "./packages/*" exec --no-install attw --pack --profile node16
```

- `exports` の不整合、`types` 欠落、CJS/ESM 混在、`files` 漏れを検知
- CI の `publint.yml` と同じチェック

### 4. 公開対象パッケージの一覧

```bash
pnpm -r --filter "./packages/*" --workspace-concurrency=1 --parseable list --depth -1
```

`private: true` でないものが自動公開される。

## 「Version Packages」 PR のレビュー観点

- 各 `packages/*/package.json` の version 上げ幅が bump 種別と一致するか
- `peerDependencies` の整合（core を上げたら依存 adapter の peerDep 範囲を確認）
- `CHANGELOG.md` に不適切な差分が混入していないか
- 関連 docs (`docs/api/*`, `packages/*/README.md`, `docs/migration/*`) が同じ PR にあるか

## トラブル時

### npm 公開が失敗する

- GitHub Actions ログで `NPM_TOKEN` 有効性を確認（`gh run view --log`）
- provenance エラーは `id-token: write` と `NPM_CONFIG_PROVENANCE=true` が `release.yml` にあるか確認
- `publishConfig.access: "public"` が該当パッケージに設定されているか（`packages/*/package.json`）

### Version Packages PR が作られない

- 保留中 changeset が 0 件（`pnpm changeset status`）
- Actions 権限: リポジトリの Settings > Actions > General で「Read and write permissions」

## ブランチ保護

main ブランチは以下を必須にすることを推奨（ユーザーに設定依頼）:

- `lint` / `build-test` / `changeset-check` / `publint`

## 実行してはいけないこと

- ローカルから `pnpm publish` / `npm publish`（CI 経由でのみ公開する）
- `Version Packages` PR を手動で `git push --force`
- 公開済みバージョンの `npm unpublish`
