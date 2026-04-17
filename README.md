# euphoric-band-site

* **CMS**

  * Notion を編集UIとして利用
  * 記事は Notion Database + Page blocks で管理（Title / Slug / Status / Date / Tags）

* **取得・変換**

  * Cloudflare Workers が Notion API を取得
  * blocks を取得 → Markdown/HTML に変換
  * 最終的に **HTMLまでレンダリング**

* **キャッシュ**

  * HTMLを生成して **ストレージ（例：R2）にキャッシュ**
  * キャッシュ内容

    * `posts.json`（記事一覧）
    * `post/{slug}.html`（記事本文）
    * `images/*`（画像）

* **表示**

  * React Router は

    * Workers APIから **キャッシュされたHTMLを取得**
    * `dangerouslySetInnerHTML` で表示
    * `marked` 自体にはHTMLサニタイズ機能がないため、**HTMLを生成する入力は信頼済み（Notion由来）を前提**とする

## notion-backend の信頼境界（Trust Boundary）

* `packages/notion-backend/src/renderer.ts` の `renderer.image` は、`href/title/text` をHTML属性向けにエスケープして埋め込む。
* `href` が空、または `http/https` 以外の不正スキーム（`javascript:` など）の場合は `<img>` を生成しない。
* `data-notion-src` はエスケープ済み値として扱い、置換時にデコードしてから `src` に再エスケープして書き戻す。
* 本リポジトリでは **Notion APIから取得したコンテンツを信頼境界内** とみなす。外部ユーザー入力をMarkdownに混在させる場合は、別途HTMLサニタイズ層（例: DOMPurify等）を追加すること。

* **更新検知**

  * Notionの `last_edited_time` を利用
  * キャッシュの編集時刻と比較し、**新しければ再生成**

* **更新方式**

  * 基本は **Stale-While-Revalidate**

    * まずキャッシュ表示
    * 裏で更新チェック

* **画像**

  * Notion画像URLは期限付き
  * Workersで **画像プロキシ → 永続キャッシュ**

* **API負荷対策**

  * 記事一覧 (`posts.json`) は **TTLキャッシュ**
  * 通常アクセスでは **Notion APIを叩かない**

* **結果**

  * 編集：Notionで簡単（スマホ可）
  * 表示：静的サイト並みの速度
  * コスト：ほぼ無料
  * 構成：Notion → Workers → Cache → React Router
