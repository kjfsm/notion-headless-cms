---
name: migration-guide
description: docs/migration/<version>.md を書く時のフォーマット。破壊的変更を before/after 形式で示し、自動化可能な grep/sed コマンドも添える
---

# migration-guide — マイグレーションガイド執筆

## いつ使うか

- 公開 API の破壊的変更
- エラーコード名前空間の変更
- キャッシュキー形式の変更
- パッケージ分割・統合

## 書式

```md
# v<old> → v<new> 移行ガイド

## 要約

- 変更の概要を 3 行以内で
- 影響を受けるパッケージを列挙

## 破壊的変更

### 1. <変更タイトル>

**変更理由**: <なぜ変えたか（1-2 行）>

**Before**:
```ts
// 旧 API
```

**After**:
```ts
// 新 API
```

**自動化**（任意）:
```bash
# 単純な置換で済む場合
find . -name "*.ts" -exec sed -i 's/oldApi/newApi/g' {} +
```

## 互換性

- 旧 API のラッパーは v<new> では**提供されない**
- deprecated 警告が v<old-1> から出ていれば明記
```

## ファイル配置

- `docs/migration/v<X>-to-v<Y>.md`
- ルート `README.md` の「ドキュメント」セクションにリンク追加
- changeset には **major** を明記

## スタイルルール

- すべて日本語
- Before/After はコード例を必ず添える
- 「影響範囲 → 対処方法 → 理由」の順で書く（読者は作業者）
- 破壊的変更が複数ある場合は番号付きリストに
- 該当 PR 番号へのリンクを文末に貼る

## 既存例

- `docs/migration/v0-to-v1.md`
