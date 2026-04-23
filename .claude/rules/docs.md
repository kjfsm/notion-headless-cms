---
description: docs/ と README.md の同期義務
paths:
  - "docs/**"
  - "**/README.md"
---

# ドキュメント同期ルール

## 基本方針

ライブラリの API / 型 / 挙動を変更した場合、**同じコミット**で関連するドキュメントも更新する。

## 対象ファイル

| 変更の種類 | 更新が必要なドキュメント |
|---|---|
| `packages/*/src/index.ts` の公開 API 追加・変更 | 該当 `packages/*/README.md` |
| CMS の公開メソッド追加・変更 | `docs/api/cms-methods.md` |
| CLI (`nhc`) のコマンド追加・変更 | `docs/cli.md` + `packages/cli/README.md` |
| アダプタの挙動変更 | `docs/recipes/<runtime>.md` + 該当パッケージの README |
| クイックスタートに影響する変更 | `docs/quickstart.md` + ルート `README.md` |
| 破壊的変更 | `docs/migration/` にマイグレーションガイド追加 |

## スタイル

- 見出しは `#` 始まり、階層は 1 つ飛ばさない
- コード例は TypeScript で書く（`ts` 指定）
- Mermaid 図は必要に応じて使う（`mermaid` 指定）
- 日本語で執筆

## ルート README のデータフロー図

- `README.md` に Mermaid フローチャートがある。依存方向を変えたら必ず更新
- SWR の注意書きも同期

## 新レシピの追加

- `docs/recipes/<name>.md` を追加
- ルート `README.md` のレシピ一覧にリンクを追加
