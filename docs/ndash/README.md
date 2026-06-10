# nDash 立ち上げドキュメント

**nDash** — Notion を書き換えると、サイトに反映される。

このフォルダは、notion-headless-cms の批判的レビューとコンセプト再定義を経て確定した後継プロダクト **nDash**（npm: `ndash`）を、**別リポジトリとして新規に立ち上げるためのドキュメント一式**である。

## 構成と読む順序

| # | ファイル | 内容 |
|---|---|---|
| 1 | [vision.md](./vision.md) | 製品ビジョン・北極星体験・成功指標・ポジショニング・Non-goals |
| 2 | [concepts.md](./concepts.md) | 中心概念（PortableContent / freshness / 編集者一級機能 / agent-native） |
| 3 | [api-design.md](./api-design.md) | 公開 API 設計（コード例中心）・旧 nhc API との対比表 |
| 4 | [architecture.md](./architecture.md) | パッケージ構成・レイヤ・設計ルール・ADR |
| 5 | [reuse-map.md](./reuse-map.md) | 旧リポジトリ（notion-headless-cms）資産の再利用マップ |
| 6 | [roadmap.md](./roadmap.md) | マイルストーン M0〜M6 と 1.0 の完了条件 |
| 7 | [bootstrap.md](./bootstrap.md) | 新リポジトリ立ち上げ手引き（ツール選定・チェックリスト） |
| 8 | [CLAUDE.md.draft](./CLAUDE.md.draft) | 新リポジトリのルートに置く CLAUDE.md の草案 |

初見は 1 → 2 → 3 の順で読めば製品の全体像が掴める。実装に着手する際は 4 → 5 → 6、リポジトリ作成時は 7 → 8 を使う。

## 新リポジトリへの転記手順

1. 新リポジトリ（例: `kjfsm/ndash`）を作成する
2. このフォルダの内容を新リポジトリの `docs/` にコピーする（この README は `docs/README.md` として索引のまま使える）
3. `CLAUDE.md.draft` を新リポジトリのルートに `CLAUDE.md` としてコピーする
4. [bootstrap.md](./bootstrap.md) のチェックリストに従って M0（scaffold）を完了させる

## 背景

旧リポジトリ notion-headless-cms に対して実コード裏取り付きの設計レビューを行い、以下が確定している（詳細な根拠は各ドキュメントに記載）:

- 北極星は「**非エンジニアが Notion を書き換えるとページに反映される**」体験。デプロイ・リビルド・静的生成を誰にも意識させない
- 旧設計の中心的な問題は (a) アイテムに関数を生やすデータモデルがシリアライズ境界を越えられないこと、(b) `content: "html"|"react"` という誤った軸、(c) SWR と称する非 SWR キャッシュ、(d) 15 パッケージに分散した公開面
- 後継 nDash は「**version 付きのシリアライズ可能な成果物（PortableContent）**」を中心概念に据え、公開面を `ndash` 1 パッケージ + サブパスに統合する
- 名称は EmDash（Cloudflare の WordPress 後継 CMS、em dash —）への対として en dash（–）+ Notion の "n"。npm の `ndash` は空きを確認済み（2026-06 時点）
