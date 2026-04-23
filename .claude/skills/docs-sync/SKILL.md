---
name: docs-sync
description: 公開 API や挙動の変更時、docs/ と README.md の更新漏れを検出・誘導する。packages/ を触ったら自動で呼ばれる
---

# docs-sync — ドキュメント同期チェック

## 目的

`packages/*/src/index.ts` の公開 API、CLI コマンド、アダプタ挙動を変更した時、関連ドキュメントが同じコミットで更新されていることを確認する。

## チェック手順

### 1. 変更範囲を特定

```bash
git diff --name-only origin/main...HEAD
```

### 2. 更新必要ファイルの対応表

| 変更 | 更新必須 |
|---|---|
| `packages/core/src/index.ts` で `export` 追加/変更 | `packages/core/README.md` / `docs/api/cms-methods.md` |
| `packages/cli/src/**` でコマンド追加/変更 | `packages/cli/README.md` / `docs/cli.md` |
| `packages/adapter-cloudflare/**` の挙動変更 | `packages/adapter-cloudflare/README.md` / `docs/recipes/cloudflare-workers.md` |
| `packages/adapter-node/**` | `packages/adapter-node/README.md` / `docs/recipes/nodejs-script.md` |
| `packages/adapter-next/**` | `packages/adapter-next/README.md` / `docs/recipes/nextjs-app-router.md` |
| `packages/cache-r2/**` | `packages/cache-r2/README.md` / `docs/recipes/custom-cache.md` |
| `packages/cache-next/**` | `packages/cache-next/README.md` / `docs/recipes/custom-cache.md` |
| `packages/source-notion/**` の公開 API | `packages/source-notion/README.md` / `docs/recipes/custom-source.md` |
| `packages/renderer/**` | `packages/renderer/README.md` |
| クイックスタートに影響 | ルート `README.md` / `docs/quickstart.md` |
| 破壊的変更 | `docs/migration/v<X>-to-v<Y>.md` 新規 |

### 3. ルート README.md のチェック

以下が古くなっていないか確認:

- データフロー Mermaid 図（依存方向）
- パッケージ一覧
- クイックスタート例のコード
- SWR の注意書き

### 4. 検出

公開 API を変更したが `packages/<name>/README.md` と `docs/` のいずれも触っていない場合、警告する:

```bash
changed_api=$(git diff --name-only origin/main...HEAD -- 'packages/*/src/index.ts')
touched_docs=$(git diff --name-only origin/main...HEAD -- 'packages/*/README.md' 'docs/**')

[ -n "$changed_api" ] && [ -z "$touched_docs" ] && echo "⚠ 公開 API を変更していますが docs が未更新です"
```

## 書式

- すべて日本語
- コード例は `ts` コードフェンスで
- 見出しは `##` 始まり（ルート README のみ `#`）
- Mermaid 図は必要な時のみ

## 参考

- `.claude/rules/docs.md`
- 既存の `docs/recipes/*` のフォーマット
