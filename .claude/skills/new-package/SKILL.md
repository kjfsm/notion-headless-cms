---
name: new-package
description: packages/<name> を新規作成する。モノレポ規約に沿って package.json / tsup / tsconfig / src/index.ts / __tests__ の雛形を配置する。副作用があるためモデルからの自動呼び出しを無効化し、/new-package <name> で明示的に呼び出す
disable-model-invocation: true
---

# /new-package <name> — 新パッケージ作成

## 手順

### 1. 事前確認

- パッケージ名が決まっているか（kebab-case 推奨: `cache-redis`, `source-contentful`）
- どの層に属するか判定:
  - `source-*` — 新しい DataSource
  - `cache-*` — 新しいキャッシュ実装
  - `adapter-*` — 新ランタイム向けファクトリ
  - その他: ユーティリティ系
- 依存方向 (`.claude/rules/package-boundaries.md`) を確認

### 2. ディレクトリ作成

```bash
mkdir -p packages/<name>/src/__tests__
```

### 3. ファイル配置

`templates/` のファイルを参考にコピーして値を置換:

- `packages/<name>/package.json` ← `templates/package.json.hbs`
- `packages/<name>/tsconfig.json` ← `templates/tsconfig.json.hbs`
- `packages/<name>/src/index.ts` ← `templates/src-index.ts.hbs`
- `packages/<name>/README.md` ← `templates/README.md.hbs`

### 4. workspace 登録

既に `pnpm-workspace.yaml` が `packages/*` を見るので登録追加は不要。vitest は `vitest.workspace.ts` に手動追加:

```ts
export default defineWorkspace([
	// ...
	"packages/<name>",
]);
```

### 5. 依存の解決

```bash
pnpm install
```

### 6. ビルド・型・テスト

```bash
pnpm --filter @notion-headless-cms/<name> build
pnpm --filter @notion-headless-cms/<name> typecheck
pnpm --filter @notion-headless-cms/<name> test
```

### 7. changeset 作成

新パッケージは `minor` で `0.1.0` 相当になる（初版は changesets が適切に扱う）:

```bash
pnpm changeset
```

### 8. ドキュメント

- ルート `README.md` のパッケージ一覧に追加
- 該当レシピ（`docs/recipes/`）に言及

### 9. NPM_TOKEN の権限確認（初回 publish 前に必須）

新パッケージは `release.yml` で初めて npm に publish される。`NPM_TOKEN` の権限が
**scope-level** (`@notion-headless-cms`) または **Automation Token** でない場合、
**404 Not Found** で publish が失敗する。詳細とチェックリストは
`docs/development.md` の「3-2. npm 側の設定 / 新パッケージ追加時のチェックリスト」を参照。

**症状**: `release.yml` の "バージョン更新PRの作成 または npm 公開" ステップで
新パッケージのみ 404 で落ち、既存パッケージは正常に publish される。

**修正**: npmjs.com で scope-level の Granular Token か Automation Token を発行し、
`gh secret set NPM_TOKEN --body "<new token>"` で差し替える。

## テンプレート変数

テンプレート内の `<name>` を置換してから保存する。

| 変数 | 例 |
|---|---|
| `<name>` | `cache-redis` |
| `<description>` | `Redis cache adapter for notion-headless-cms` |
| `<keyword>` | `redis` |

## 参考

既存の `packages/cache-r2/` が最小構造の参考になる。
