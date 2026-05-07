# 類似ヘッドレス CMS との比較

`@notion-headless-cms` を採用すべきか判断するための、主要なヘッドレス CMS / Notion 連携ライブラリとの比較資料。

> 比較対象は **「Web サイト・アプリにコンテンツを配信する」** ユースケースに絞り、UGC プラットフォームや E コマース専用ツールは除外している。

## サマリー: ポジショニングマップ

```
                 編集 UX が独自 UI
                        ▲
                        │
       Contentful ●     │     ● Sanity
                        │
       Strapi ●         │     ● Payload
                        │
   ─────────────────────┼─────────────────────▶
   SaaS / フルマネージド │   OSS / セルフホスト
                        │
                        │     ● notion-headless-cms
       Decap CMS ●      │     ● react-notion-x
                        │
                        ▼
                 編集 UX が既存ツール
                 (Notion / Git / etc.)
```

横軸 = 運用形態、縦軸 = 編集体験。`notion-headless-cms` は「**OSS** × **既存の Notion を編集 UI として使う**」象限に位置する。

## 機能マトリクス

| 項目 | notion-headless-cms | Contentful | Sanity | Strapi | Payload | Decap CMS | react-notion-x |
|---|---|---|---|---|---|---|---|
| 種別 | OSS ライブラリ | SaaS | SaaS（Studio セルフホスト可） | OSS セルフホスト | OSS セルフホスト | OSS / Git ベース | OSS レンダラ |
| 編集 UI | **Notion 本体** | 独自 Web UI | Sanity Studio (React) | 管理画面 | 管理画面 (React) | Git commit / プレビュー | なし（描画のみ）|
| データストア | Notion | Contentful CDN | Sanity Content Lake | 自前 DB | MongoDB / Postgres | Git リポジトリ | — |
| クエリ言語 | Notion API filter | REST / GraphQL | **GROQ** / GraphQL | REST / GraphQL | REST / GraphQL / Local API | — | — |
| 配信モデル | アプリ側で SWR キャッシュ | グローバル CDN | グローバル CDN + CDN 画像 | 自前 API | 自前 API | 静的ファイル | クライアント描画 |
| エッジ最適化 | **Workers + R2/KV ネイティブ** | CDN | CDN | 不可（Node サーバ） | 不可（Node サーバ） | 静的のみ | 不問 |
| 型生成 | CLI (`introspect`) で自動生成 | CLI / GraphQL Codegen | スキーマ → 型 | 型生成あり | TS-first（型推論） | 弱い | — |
| Draft / Preview | Notion の編集中ページ参照 | Preview API | Draft Perspective | Draft & Publish | Draft & Publish | Editorial Workflow | — |
| 多言語 | 自前構築 | **i18n 内蔵** | i18n プラグイン | i18n プラグイン | Localization 内蔵 | 自前 | — |
| ロール / 権限 | Notion 依存 | 詳細 RBAC | RBAC | RBAC | RBAC | Git 権限 | — |
| 画像 CDN | R2 プロキシ + SHA256 永続化 | Images API | **画像変換 CDN** | プラグイン | プラグイン | 自前 | — |
| 全文検索 | なし | Search API | GROQ + Listener | プラグイン | プラグイン | なし | — |
| Webhook / リアルタイム | last_edited_time 比較 + 任意 hook | Webhook | **Listener / Live Content** | Webhook | Webhook | — | — |
| 価格 | OSS（Notion 料金のみ） | 有料 + 無料枠 | 有料 + 無料枠 | OSS | OSS | OSS | OSS |
| 想定スケール | 個人〜中規模 | 中〜エンタープライズ | 中〜エンタープライズ | 中規模 | 中規模 | 小〜中規模 | — |

## 強み / 弱み比較

### `notion-headless-cms`

**強み**
- 編集 UI が Notion なので非エンジニアの学習コスト 0
- `cloudflarePreset({ env })` 1 行で Workers + R2/KV 配信
- `last_edited_time` 比較による差分再生成（SWR）
- Notion 画像 URL の 1 時間失効を SHA256 ハッシュキャッシュで解決
- `react-renderer` が shiki / katex / embed まで全ブロック対応
- `core` がゼロ依存。Node / Next / Astro / Hono / SvelteKit に同一 API

**弱み**
- 多人数の draft / 承認ワークフローは Notion 機能止まり
- GROQ / GraphQL のような高度なクエリは不可
- Notion API のレートリミット（〜3 req/s）が天井
- Sanity 風の画像変換 CDN は無し（プロキシで近似）
- リアルタイム購読・全文検索なし

### Contentful
- ✅ エンタープライズ向けワークフロー、i18n、CDN が成熟
- ❌ 高価。スキーマ変更にロックインされやすい

### Sanity
- ✅ GROQ・Live Content・画像変換 CDN が強力
- ❌ Studio のカスタマイズに React 開発が必要

### Strapi / Payload
- ✅ DB を自分で持てる。OSS で完全自前運用
- ❌ サーバ運用コスト。エッジ非対応

### Decap CMS / Keystatic
- ✅ Git ベースで完全に静的配信
- ❌ 編集 UI / プレビュー機能が弱い

### react-notion-x
- ✅ Notion 公式に近い見た目を最速で出せる
- ❌ キャッシュ・型生成・配信戦略は自作

## 用途別おすすめ

```
個人ブログ / ドキュメントサイト
  └─ 編集者が Notion を使っている
       └─ ✅ notion-headless-cms

中規模メディア / コーポレートサイト
  ├─ Notion で運用したい・エッジ配信したい
  │    └─ ✅ notion-headless-cms
  ├─ 構造化コンテンツ + 画像 CDN 重視
  │    └─ Sanity
  └─ 多人数ワークフロー・i18n 必須
       └─ Contentful

エンタープライズ
  ├─ SaaS で良い
  │    └─ Contentful / Sanity
  └─ 自前 DB / オンプレ
       └─ Strapi / Payload

開発者だけが編集する静的サイト
  └─ Decap CMS / Keystatic
```

## 「Notion を CMS にする」枠での比較

Notion をデータソースに使うライブラリは複数あるが、機能カバレッジは大きく違う。

| ライブラリ | スコープ | キャッシュ | 型生成 | エッジ | 全ブロック描画 |
|---|---|---|---|---|---|
| **notion-headless-cms** | エンジン + レンダラ + キャッシュ + CLI | SWR + R2/KV/メモリ | ✅ CLI | ✅ Workers | ✅ |
| react-notion-x | レンダラ | ❌ | ❌ | △ | ✅ |
| notion-on-next | サンプル | ❌ | ❌ | △ | △ |
| NotionAPI / notion-client | API ラッパー | ❌ | ❌ | △ | ❌ |
| Astro Notion Blog | テンプレート | △ | ❌ | △ | △ |

→ **「Notion を編集 UI に、Workers/Edge で SWR 配信する」用途では本ライブラリが現状最も網羅的**。

## 関連ドキュメント

- [`docs/architecture.md`](./architecture.md) — 設計思想
- [`docs/quickstart.md`](./quickstart.md) — セットアップ
- [`docs/cli.md`](./cli.md) — `introspect` / 型生成
