# メタパッケージの連鎖 bump (Issue #318 / M7)

`@notion-headless-cms/{node,cloudflare,next}` の各メタパッケージは、
内部で `core` / `notion-source` / `cache` / `markdown-html` 等を `dependencies`
として束ねる。下層パッケージの破壊的変更は、changeset の
`updateInternalDependencies: patch` ルールで自動的にメタパッケージへ patch bump
として伝播する。

## 自動伝播の仕組み

`.changeset/config.json`:

```json
"updateInternalDependencies": "patch"
```

下層パッケージで minor / major changeset を作ると、メタパッケージは少なくとも patch
bump として `Version Packages` PR に反映される。

## 連鎖 bump を明示的に上げたい場合

利用側パッケージで「破壊的変更が露出している」場合 (例: `@notion-headless-cms/client`
の `createCMS` シグネチャを変更したい)、その changeset で当該パッケージを
**明示的に minor / major** で列挙する。下層の bump 種別 (patch) は自動継承される。

```md
---
"@notion-headless-cms/client": minor
---

createCMS の collections の型を絞り込み。
```

## レビュー時のチェック観点

- changeset 一覧と Version Packages PR の差分が一致しているか
- 連鎖 bump の段差 (下層 major / メタ patch) が許容されるか
  - 通常は OK (利用者は通常メタパッケージのみインストール)
  - 利用者が下層を直接 `import` している場合は **メタ側も major** にすべき
- `attw --pack` / `publint --strict` が release-dry-run.yml で通っているか

## CI gate (Issue #318 / M7)

- `ci.yml` verify: `pnpm verify:ci` (build / typecheck / test / publint / attw) + `pnpm size`
- `release-dry-run.yml`: Version Packages PR で `pnpm publish --dry-run`
- `publish-dry-run-nightly.yml`: main の任意時点で publint / attw / size + dry-run
- 破壊的変更時は手動で本ドキュメントへリンクするレビューコメントを残す
