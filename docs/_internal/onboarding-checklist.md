# オンボーディングチェックリスト (5 分計測用)

初見プログラマが `console.log(posts)` を出力するまでの所要時間を測定するためのシナリオ。
v1.0 リリース前に最低 1 名（社外推奨）で実測すること。

## 前提
- Node.js 24 以上
- pnpm
- Notion アカウント

> **注記（v2 廃止に伴う更新）**: このリポジトリの現行アーキテクチャは `@notion-headless-cms/cms`
> のみ（v2 系 13 パッケージは削除済み）。v3 にはスキーマ codegen（`nhc generate`）が無く、
> `defineCollection`/`defineSchema` を手書きする運用になったため、手順を現行 API に合わせて
> 更新した。

## 手順

- [ ] 1. `pnpm add @notion-headless-cms/cms @notionhq/client` (目標: 30秒)
- [ ] 2. Notion インテグレーション作成 → データベースに接続 (目標: 2分)
- [ ] 3. `NOTION_TOKEN` を環境変数に設定 (目標: 15秒)
- [ ] 4. `schema.ts` に `defineCollection`/`defineSchema` を数行で手書き (目標: 30秒、README コピペ)
- [ ] 5. `cms.ts` に `createCMS({ schema, notion: { token } })` を作成 (目標: 30秒、README コピペ)
- [ ] 6. `console.log(await cms.posts.list())` 実行 (目標: 10秒)

合計目標: 5 分以内

## 記録欄

| 計測日 | 実測者 | 所要時間 | つまずいたポイント |
|---|---|---|---|
| | | | |
