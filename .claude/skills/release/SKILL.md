---
name: release
description: npm 公開前のリリース前チェックと手順。副作用があるためモデルからの自動呼び出しを無効化する。明示的に /release と指示された時のみ使う
disable-model-invocation: true
---

# /release — リリース手順

## 前提

リリースは **canary（自動）** と **stable（手動）** の二段構え。

- **canary**: `main` にマージするたびに `release.yml` が起動し、保留中 changeset の内容から snapshot バージョン（`0.0.0-canary-<sha>`）を組み立てて `canary` タグで自動 npm 公開する。`Version Packages` PR は作らず、changeset ファイルも消費しない。
- **stable**: `release-stable.yml` を **workflow_dispatch で手動起動**した時だけ動く。保留中 changeset があれば `Version Packages` PR を自動作成し、そのPRをマージすると（`Version Packages` で始まるコミットの push を検知して）同ワークフローが再度走り `latest` タグで npm に自動公開（provenance 付き）する。

**手動操作は「stable リリースを出したい時に workflow_dispatch を叩く」だけ**。以下は「リリース前レビュー」と「トラブル時の診断」の手順。

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

### npm 公開が失敗する（canary / stable 共通）

- GitHub Actions ログで `NPM_TOKEN` 有効性を確認（`gh run view --log`）
- provenance エラーは `id-token: write` と `NPM_CONFIG_PROVENANCE=true` が該当ワークフローにあるか確認
- `publishConfig.access: "public"` が該当パッケージに設定されているか

### canary publish が `latest` を汚してしまっていないか不安な時

- `pnpm release:snapshot`（= `changeset publish --tag canary --no-git-tag`）は `--tag` を script に固定しているので tag 忘れは起きない構造になっている
- `.changeset/config.json` の `snapshot.useCalculatedVersion: false` により canary は常に `0.0.0-canary-*`（`^3.x` などの semver range には絶対にマッチしない）
- 心配な場合は `npm dist-tag ls @notion-headless-cms/<pkg>` で `latest`/`canary` の指す版を確認する

### 同じ commit で canary ワークフローを re-run すると失敗する

- `0.0.0-canary-<sha>` は commit 単位で決定論的なため、同一 sha への再 publish は npm 側で衝突しうる（想定内・実害なし。何も変わっていないので再 publish 自体が不要）

### Version Packages PR が作られない（stable）

- 保留中 changeset が 0 件（`pnpm changeset status`）
- `release-stable.yml` を workflow_dispatch で起動したか（push だけでは Version PR は作られない）
- リポジトリ Settings > Actions > General が「Read and write permissions」

## 実行してはいけないこと

- ローカルから `pnpm publish` / `npm publish`（CI 経由でのみ公開する。`release:local` は緊急フォールバックのみ）
- `Version Packages` PR を手動で `git push --force`
- 公開済みバージョンの `npm unpublish`（canary・stable とも）
