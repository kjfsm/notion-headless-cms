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

**手動操作は原則不要**。以下は「リリース前レビュー」と「トラブル時の診断」の手順。

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
pnpm verify    # build + typecheck + test + publint をまとめて実行
```

### 3. 公開物の検査

`/publish-preflight` を実行する。publint / attw / exports 経路 / engines / provenance を一括チェック。
重複手順は本ファイルに書かず、必ずそちらに委ねる。

## 「Version Packages」 PR のレビュー観点

- 各 `packages/*/package.json` の version 上げ幅が bump 種別と一致するか
- `peerDependencies` の整合（core を上げたら依存 adapter の peerDep 範囲を確認）
- `CHANGELOG.md` に不適切な差分が混入していないか
- 関連 docs (`docs/api/*`, `packages/*/README.md`) が同じ PR にあるか

## トラブル時

### npm 公開が失敗する

- GitHub Actions ログで `NPM_TOKEN` 有効性を確認（`gh run view --log`）
- provenance エラーは `id-token: write` と `NPM_CONFIG_PROVENANCE=true` が `release.yml` にあるか確認
- `publishConfig.access: "public"` が該当パッケージに設定されているか

### Version Packages PR が作られない

- 保留中 changeset が 0 件（`pnpm changeset status`）
- リポジトリ Settings > Actions > General が「Read and write permissions」

## 実行してはいけないこと

- ローカルから `pnpm publish` / `npm publish`（CI 経由でのみ公開する）
- `Version Packages` PR を手動で `git push --force`
- 公開済みバージョンの `npm unpublish`
