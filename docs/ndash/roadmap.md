# nDash ロードマップ

各マイルストーンに**完了条件（Definition of Done）**を付ける。完了条件はすべて自動検証可能（テスト・E2E・CI）であることを優先する。

## M0 — scaffold

リポジトリ初期化。[bootstrap.md](./bootstrap.md) の手順そのもの。

**完了条件**
- pnpm モノレポ + TypeScript + Biome + vitest + changesets（fixed group）+ CI（typecheck / lint / test）が回る
- `CLAUDE.md`（draft から配置）と docs 一式が配置済み
- npm に `ndash@0.0.0` をプレースホルダ公開し名前を確保

## M1 — data 層

`defineCollection` + 型推論 + typed query。

**完了条件**
- `defineCollection({ database, slug, properties, published })` から `InferEntry` の型推論が効く（status options の補完含む）
- `list({ where, sort, limit, cursor })` が Notion API filter / sorts / cursor に push down される（型導出された演算子のみ受理）
- `get(slug)` がメタのみのプレーンデータを返す
- 公開ポリシー（published / accessible）が defineCollection の 1 箇所で効く
- `structuredClone` / `JSON.stringify` ラウンドトリップのテストが全公開戻り値に対して通る

## M2 — content pipeline

PortableContent 生成と変換器。

**完了条件**
- `get(slug, { body: "blocks" })` が PortableContent（version / blocks / images / links）を返す
- 画像が SHA256 ハッシュで永続化され、blocks 内 URL が `{mount}/images/{hash}` に解決済み
- 内部リンク（link_to_page / mention）が自動解決済み
- `ndash/html` / `ndash/markdown` / `ndash/react`（headless）が同一 blocks から出力できる
- `body` で要求された表現以外を生成・キャッシュしないことをテストで保証

## M3 — freshness loop

「1 分以内反映」をゼロ配線で。

**完了条件**
- `freshness: "fast"` 既定で、serve-stale + scheduled（Workers cron / Node interval）が動く
- リクエスト処理中に Notion へ同期アクセスしない（キャッシュヒット時）ことをテストで保証
- `freshness: "instant"` で webhook 受信 → 該当 artifact のみ再生成
- `dash.$revalidate()` / `$handler` / `$scheduled` が揃う
- `ndash doctor` が mount 疎通・webhook 設定・token 権限を診断できる
- E2E: Notion を書き換え → 設定時間内にレスポンスが変わる

## M4 — editor features

編集者を一級ユーザーに。

**完了条件**
- `get(slug, { access: "preview" })` + 署名付きプレビュー URL（公開 artifact と別キー）
- プレビュー URL の Notion プロパティ書き戻し（opt-in）
- slug 重複・必須プロパティ欠落の検出と Notion コメント通知（opt-in）
- fail-soft: artifact 再生成が失敗しても直前の正常 artifact を配信し続けることをテストで保証
- `ndash/next` の draftMode 連携

## M5 — adapters + examples + dogfooding

**完了条件**
- `ndash/hono` / `ndash/react-router` / `ndash/next` / `ndash/astro` / `ndash/workers` が「mount 1 箇所」で動く
- examples（最低 4 構成）+ Playwright E2E
- nDash のドキュメントサイト自体を nDash で配信（dogfooding）

## M6 — agent-native

**完了条件**
- `ndash mcp` が起動し、コンテンツ取得 / introspection / revalidate / doctor をツールとして公開
- 全 CLI コマンドに `--json`、副作用コマンドに `--dry-run`
- agent skill（セットアップ手順）を 1 つ以上同梱

## 1.0

**完了条件**
- M1〜M6 完了 + 公開 API の破壊的変更予定がない状態
- ドキュメント: quickstart（10 分でライブ反映体験）/ API リファレンス / エラー一覧 / nhc からの移行ガイド
- 旧 notion-headless-cms の README に nDash への案内を追記（旧リポジトリはメンテナンスモードへ）

## 順序の意図

- M1（data）を最初に独立完了させるのは、型推論と push down が**全レイヤーの土台**であり、かつ単独でテスト可能だから
- freshness（M3）を editor features(M4) より先に置くのは、北極星の核が「反映される」体験だから
- agent-native（M6）を最後に置くのは、MCP ツールの中身（get / revalidate / doctor）が M1〜M4 の成果物そのものだから — 先に作ると二度作ることになる
