# 移行ガイド

`@notion-headless-cms/*` の破壊的変更・非推奨 API ごとの移行手順をまとめています。
新しいガイドは「削除予定バージョン」順に上から並べています。

## v1.0.0 で削除予定

- [`createNotionCollection({ blocks, ogp, enrichers })` → `content: blocksFetcher({...})`](./blocks-ogp-enrichers.md)
- [`createCms` (各ランタイムパッケージ) → `createClient`](./createCms-to-createClient.md)

## 関連

- バージョン整列方針: 詳細は `docs/ja/release/1.0-checklist.md` (準備中)
- 破壊的変更の追跡: 各パッケージの `CHANGELOG.md`
