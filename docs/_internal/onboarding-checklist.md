# オンボーディングチェックリスト (5 分計測用)

初見プログラマが `console.log(posts)` を出力するまでの所要時間を測定するためのシナリオ。
v1.0 リリース前に最低 1 名（社外推奨）で実測すること。

## 前提
- Node.js 24 以上
- pnpm
- Notion アカウント

## 手順

- [ ] 1. `pnpm add @notion-headless-cms/client @notion-headless-cms/cli` (目標: 30秒)
- [ ] 2. Notion インテグレーション作成 → データベースに接続 (目標: 2分)
- [ ] 3. `NOTION_TOKEN` を環境変数に設定 (目標: 15秒)
- [ ] 4. `nhc.config.ts` を作成 (目標: 30秒、README コピペ)
- [ ] 5. `npx nhc generate` でスキーマ生成 (目標: 20秒)
- [ ] 6. `cms.ts` を 6 行作成 (目標: 30秒、README コピペ)
- [ ] 7. `console.log(await cms.posts.list())` 実行 (目標: 10秒)

合計目標: 5 分以内

## 記録欄

| 計測日 | 実測者 | 所要時間 | つまずいたポイント |
|---|---|---|---|
| | | | |
