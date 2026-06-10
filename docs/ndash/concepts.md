# nDash 中心概念

このドキュメントは nDash の設計を支える 4 つの概念を定義する。すべての API・実装判断はここから導出される。

## 1. PortableContent — 中心となる不変条件

> **コンテンツは、直列化可能・version スタンプ付きの JSON 成果物（artifact）である。**

```ts
interface PortableContent {
  /** 再検証の基準。Notion の last_edited_time */
  version: string;
  /** コレクション名と slug（artifact の住所） */
  collection: string;
  slug: string;
  /** スキーマから型推論されるメタデータ（title / status / tags / ...） */
  meta: Record<string, unknown>;
  /** canonical な本文表現: Notion BlockObjectResponse ツリー */
  blocks: NotionBlock[];
  /** 解決済みの画像参照（Notion 署名 URL → 永続ハッシュ） */
  images: Record<string, { hash: string }>;
  /** 内部リンクグラフ（link_to_page → 自サイト URL） */
  links: Record<string, { collection: string; slug: string }>;
  generatedAt: string;
}
```

### なぜこれが中心か

旧 nhc の最大の罠は、`find()` の戻り値に `html()` / `notionBlocks()` という**関数を生やした**ことだった（旧 `packages/core/src/collection.ts:336-347`）。関数付きオブジェクトは React Router / Next.js の loader 境界・RSC 境界・`JSON.stringify`・KV 保存のすべてで壊れ、利用者は境界を越える直前に必ず手で剥がす必要があった。旧リポジトリの example 自身がその儀式を踏んでいる。

PortableContent を不変条件にすると、バラバラだった概念がすべて導出になる:

| 概念 | PortableContent からの導出 |
|---|---|
| キャッシュ | 「この JSON をどこに置くか」（KV / R2 / メモリ / ISR — 単なるストア） |
| 再検証 | 「`version` を比較して、変わった artifact だけ作り直す」 |
| プレビュー | 「draft の artifact を別キーで作る」 |
| loader / RSC 境界 | ただの JSON なので素通り |
| レンダラー | JSON を受け取る純粋な変換器（React / HTML / Markdown） |

Astro Content Collections（entry）、react-notion-x（recordMap）、Contentlayer（生成 JSON）が全員この形に到達している。nDash はライブ反映を「version 比較 → 差分再生成」として実装するため、この概念は北極星と完全に整合する。

### 派生ルール（絶対ルール化する）

- **公開 API が返すデータに関数・クラスインスタンスを含めない**
- 本文表現の canonical は **Notion blocks ツリー 1 つ**。HTML / Markdown は変換器による派生であり、artifact には要求されたときのみ含める（旧 nhc は全モードで 4 表現を毎回生成していた — 旧 `rendering.ts:66-197`）
- 独自中間 AST（旧 `ContentBlock`）は作らない

## 2. freshness — 鮮度ループはライブラリが全自動で所有する

「反映される」が製品の約束である以上、鮮度の実現手段をユーザーの宿題にしない。ユーザーに見せるノブは 1 つ:

```ts
createDash({
  ...,
  freshness: "fast",  // 既定
});
```

| 値 | 挙動 | 反映時間 |
|---|---|---|
| `"fast"`（既定） | serve-stale + scheduled ポーリング（Workers cron / Node interval を同梱） | 1 分以内 |
| `"instant"` | `"fast"` + Notion webhook 受信（mount に統合済み、`ndash doctor` で疎通検証） | 数秒 |
| `{ freshFor, staleWhileRevalidate, blocking }` | 上級者向けの明示制御 | 任意 |

### 設計判断: serve-stale を既定にする（旧 nhc からの反転）

旧 nhc は「古いデータは返さない」を要件とし、TTL 切れをブロッキング再取得にしていた（旧 `collection.ts:93-110`）。さらに TTL 内も毎リクエスト Notion へ差分チェックが飛び、rate limit（3req/s）を消費していた。

これは北極星に逆行する。編集直後・TTL 切れ後の最初の訪問者が Notion API 待ちで遅くなる一方、「数十秒古いデータが見える」ことは誰の体験も損なわない — 編集者は自分のリロードで最新が見えればよく、読者は古さに気づかない。よって:

- **既定は serve-stale**: キャッシュを即返しし、裏で version 比較 → 差分再生成
- ポーリングは**リクエストに同期させない**（scheduled で一定間隔。リクエスト毎に Notion を叩かない）
- ブロッキング動作（旧挙動）が必要なら `blocking: true` の明示 opt-in

### 隠す概念

旧 nhc には鮮度に関する概念が 7 つあった（SWR / TTL / webhook / ポーリング / `check` / `warm` / `bypassCache`）。nDash では `check` / `peekVersion` / poll URL / `warm` をすべて内部実装またはフレームワークグルーの中に隠し、公開概念は `freshness` 1 つにする。なお「SWR」という語は本来の stale-while-revalidate（RFC 5861）の意味でのみ使う。

## 3. 編集者一級機能 — 第二のユーザーを API に存在させる

旧 nhc の API はエンジニアしか見ていなかった。nDash は編集者向け機能を一級で持つ:

1. **プレビューリンク**
   draft 記事の署名付き URL（`access: "preview"`、artifact は公開用と別キー）。さらに生成したプレビュー URL を **Notion のページプロパティに書き戻し**、編集者が Notion 内から 1 クリックで開けるようにする
2. **editorial workflow = Notion の status**
   公開制御は Notion の status プロパティそのもの。旧 nhc では CLI config の `publishedStatuses` が受理されつつ無視される dead option で、「下書きが公開される」サイレント事故の温床だった（旧 `cli/src/index.ts:21-23`）。nDash では公開ポリシーの住所を `defineCollection` の 1 箇所に限定し、設定が効かない経路を型で塞ぐ。将来的には Notion の status group（"Complete" 等）から published を既定推論し、設定自体を不要にする
3. **ミスのフィードバックを Notion に返す**
   slug 重複・必須プロパティ欠落・壊れた内部リンクを検出したら、サイトを壊す代わりに **Notion のコメント／プロパティで編集者に通知**する（runtime 検出 + `ndash doctor`）
4. **fail-soft 保証（仕様として明文化）**
   編集者が何をしても、サイトは**最後の正常な artifact を配信し続ける**。新しい artifact の生成に失敗したら、古い artifact を出し続けつつエンジニアに logger / `onError` で通知する。「編集者のミス → 5xx」の経路を仕様レベルで塞ぐ

## 4. agent-native — エージェントを第三のユーザーにする

EmDash（Cloudflare の WordPress 後継 CMS）が示した方向性を取り込む。Notion に公式 MCP がある今、「Notion MCP（書く側）+ nDash MCP（配信側）」で**記事の執筆 → 公開 → 反映確認までをエージェントで完結**できる。

1. **ビルトイン MCP サーバー**（`ndash mcp`）
   コンテンツ取得・スキーマ introspection・revalidate（artifact 再生成）・doctor（疎通診断）を MCP ツールとして公開する
2. **機械可読 CLI**
   全コマンドに `--json` 出力。副作用のあるコマンドは dry-run を持つ。終了コードと構造化エラー（`code` 付き）でエージェントが分岐できる
3. **agent skills の同梱**（将来）
   「nDash サイトをセットアップする」「スキーマを変更する」等の手順を skills として配布する
