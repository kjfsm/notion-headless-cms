# 移行ガイド

`@notion-headless-cms/*` の破壊的変更・非推奨 API ごとの移行手順をまとめています。
新しいガイドは「削除予定バージョン」順に上から並べています。

## v2（メタパッケージ廃止・createCMS 集約）

- メタパッケージ `@notion-headless-cms/{node,cloudflare,next}` を廃止し、
  `@notion-headless-cms/client` の `createCMS`（+ `/cloudflare` `/next` `/react` サブパス）へ集約。
  設計背景は [`rfc/v2-usability-redesign.md`](../rfc/v2-usability-redesign.md) を参照。
- 旧 `createClient` + `notionSource` + preset 合成は `@notion-headless-cms/client` が
  re-export する escape hatch として引き続き利用可能。

## v1.0.0 で削除予定

- [`createNotionCollection({ blocks, ogp, enrichers })` → `content: blocksFetcher({...})`](./blocks-ogp-enrichers.md)

## 他システムからの移行

- [Contentful → @notion-headless-cms (DataSourceAdapter 自作)](./contentful.md)

## 関連

- バージョン整列方針: 詳細は `docs/ja/release/1.0-checklist.md` (準備中)
- 破壊的変更の追跡: 各パッケージの `CHANGELOG.md`
