---
name: publish-preflight
description: npm 公開前の最終チェック。publint / attw / exports 経路 / engines 整合 / 型定義の同梱 / dist の存在確認を実行する。副作用は無いが明示呼び出し推奨
disable-model-invocation: true
---

# /publish-preflight — 公開前チェック

## 目的

CI の `publint.yml` が走る前にローカルで同等の検査を回し、公開ブロッカーを先回りで潰す。

## 実行

### 1. クリーンビルド

```bash
pnpm -r --filter "./packages/*" run build
```

### 2. publint

```bash
pnpm -r --filter "./packages/*" exec publint
```

検出される代表的な問題:

- `exports` が `package.json` に無い
- `types` フィールドが `.d.ts` を指していない
- `main` と `exports` の食い違い
- `files` に `dist` が含まれていない

### 3. @arethetypeswrong/cli (attw)

```bash
pnpm -r --filter "./packages/*" exec --no-install attw --pack --profile node16
```

検出される代表的な問題:

- CJS/ESM 解決パスで型が欠落
- `types` の指すファイルが dist に存在しない

### 4. exports 経路確認

各パッケージ `package.json` の `exports` に書かれているサブパスを手で試す:

```bash
# 例: core の errors サブパス
node --input-type=module -e "import * as e from '@notion-headless-cms/core/errors'; console.log(Object.keys(e))"
```

### 5. engines 整合

```bash
jq -r '.engines.node' packages/*/package.json
```

すべて `>=24` であること。

### 6. provenance 有効化

`publishConfig: { provenance: true }` がすべての公開パッケージに入っていること。

## すべてパスしたら

```bash
pnpm changeset status --since=origin/main
```

で意図通りのバージョン計画が出ているかを最終確認。その後 PR を作成する。
