---
name: changeset-flow
description: packages/** に変更があり npm 公開に影響する場合、pnpm changeset を使って変更記録ファイルを作成する。bump 種別 (patch/minor/major) の判定と対象パッケージの列挙、changeset md の雛形提示を行う
allowed-tools:
  - Bash(pnpm changeset:*)
  - Bash(git diff:*)
  - Read
  - Grep
  - Glob
  - Write
  - Edit
---

# /changeset-flow — changeset 作成フロー

## 目的

`packages/*` の変更がリリースに影響する場合、`pnpm changeset` によるバージョン管理ファイルを作成する。このリポジトリは changesets で自動リリースされるため、**changeset が無い PR は CI で失敗する**（`.github/workflows/changeset-check.yml`）。

## 実行手順

### 1. 影響を受けるパッケージを特定する

```bash
git diff --name-only origin/main...HEAD -- 'packages/**'
```

公開対象（`private: false`）かどうかは `packages/<name>/package.json` を確認。

### 2. bump 種別を判定する

| bump | 条件 |
|---|---|
| **major** | 公開 API の破壊的変更（関数シグネチャ・型の削除/変更・オプション必須化） |
| **minor** | 公開 API の追加（後方互換） |
| **patch** | バグ修正・内部リファクタ・ドキュメント更新・型の非破壊改善 |

複数パッケージに影響が波及する場合は**依存パッケージにも同時に changeset を書く**。

### 3. changeset を作成

対話式:

```bash
pnpm changeset
```

または直接 `.changeset/<kebab-case-name>.md` を `templates/changeset.md` を参考に書く:

```md
---
"@notion-headless-cms/core": patch
"@notion-headless-cms/adapter-node": patch
---

core の SWR キャッシュでキー衝突が発生する問題を修正。
```

### 4. コミット

changeset md を**変更本体と同じコミット**に含める:

```bash
git add .changeset/*.md
git commit -m "<日本語の変更理由>"
```

## 判定のコツ

- `peerDependencies` の最小バージョンを上げる → **minor 以上**
- `dependencies` / `peerDependencies` の追加 → **minor 以上**
- エラーコード (`CMSError.code`) の名前空間変更 → **major**（利用側の `isCMSErrorInNamespace` に影響）
- internal 実装のみ変更 → **patch**
- 型の `{ a: string }` → `{ a: string; b?: number }` の**追加** → patch（後方互換）

## 避けるべき事

- `packages/*/README.md` のみの変更でも、公開される範囲に含まれるなら **patch** changeset を推奨
- `examples/**`, `docs/**`, `.github/**` の変更には changeset 不要（ラベル `skip-changeset` を付与）
- `pnpm-lock.yaml` のみの変更にも changeset 不要

## 参考

- `.changeset/config.json` — access/ignore 設定
- `.changeset/README.md` — リポジトリの運用方針
