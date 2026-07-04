# @notion-headless-cms/cms

## 3.0.2

### Patch Changes

- 2f53d86: `@notion-headless-cms/cms/cloudflare` から `SyncCoordinatorDOInstance` 型を export した。

  - `createSyncCoordinatorDO()` の戻り値（DO コンストラクタ）が実装するインスタンス型は、
    利用側が Worker から re-export して `wrangler.toml` にバインドする必要がある公開契約の
    一部だが、これまで export リストから漏れていた
  - 未 export のため、`tsc -b`（`composite: true`）でこの型を含む宣言ファイルを出力する際に
    「名前を付けられない型」エラーになっていた

## 3.0.1

### Patch Changes

- eac80a3: `list()` の戻り値の `meta` をスキーマ由来の型に絞り込むようにした（`find()` と一貫）。

  - これまで `list()` は `ListResult<IndexEntry>` を返し `meta` が `JsonValue` だったが、`ListResult<CollectionIndexEntry<C>>` に変更し `meta` を当該コレクションの `InferEntry<C>` として型付けする
  - ドライバが index にも本体と同一の full meta を書き込む現状の実装に基づく型付けのためランタイムは無改修（型のみの強化）
  - `CollectionIndexEntry` / `CollectionEntrySnapshot` を型エクスポートに追加

- eac80a3: `createCMS` に `logger` / `logLevel` を追加し、同期・配信経路を構造化ログで監視できるようにした。

  - `logger`（`debug`/`info`/`warn`/`error` を持つオブジェクト）と `logLevel`（下限レベル）を受け取り、`logLevel` 未満のレベルは内部で抑制する（未指定なら no-op）
  - 計装点: Notion クエリ失敗（error）・entry の同期成功（debug）／失敗（warn）・API リトライ待機（debug、`attempt`/`backoffMs` 付き）・webhook 受信（info）／署名不正（warn）・画像 404（warn）
  - `Logger` / `LogLevel` / `LogContext` 型をエクスポート

- eac80a3: `defineCollection` の `slug` を任意にした。slug 列を持たない設定値コレクション（選択肢リスト・埋め込み情報など）を、種別（`kind`）を増やさずに定義できる。

  - `slug` を省略したコレクションは、エントリを Notion の page id でアドレスする（`find(pageId)` で取得、`list()` は全件を返す）。どのプロパティも slug に流用しないため、タイトル等への暗黙の一意性要求が発生しない
  - `slug` を指定したコレクションで値が空のページは従来どおり `CMSError(sync/slug_missing)` を投げる（壊れた URL を防ぐ設定ミス検知）
  - 内部の sync → store → index → find → list は slug 有無で分岐せず単一経路のまま。slug 未設定コレクションは内部リンク解決用 `PageIndex` からは除外する（URL ルーティングしないため）

## 3.0.0

### Patch Changes

- 569ce76: `examples/cloudflare-astro` を v2 API から v3 API（`@notion-headless-cms/cms`）へ書き直した。

  - KV/R2 は永続ストア（`kvDocStore`/`r2BlobStore`）のまま、同期スケジューラは
    `createNodeSyncScheduler()`（Astro の Cloudflare アダプタが DO クラスを
    export できる main エントリを提供しないため、DO 版は `cloudflare-hono`/
    `cloudflare-react-router` に譲り、このサンプルはシンプルな構成のまま維持）
  - `render:{content:"html"}` + `post.html()` を `renderBlocksToHtml`
    （`@notion-headless-cms/cms/html`）に置換

- aab824b: `examples/cloudflare-hono` を v2 API から v3 API（`@notion-headless-cms/cms`）へ書き直した。

  - `wrangler.toml` に `SyncCoordinatorDO`（`durable_objects.bindings` + `migrations`）を追加。
    Notion API への直列アクセスを DO に一元化し、読者用の stateless Worker は KV/R2 の
    読み取りのみ行う（`createCMS({ syncDelegate: durableObjectSyncDelegate(...) })`）
  - `render:{content:"html"}` + `post.html()` を `renderBlocksToHtml`（`@notion-headless-cms/cms/html`）
    に置換
  - 動作確認・初回コールドスタート用に `POST /api/sync/kick`（`cms.sync.kick()` を手動発火する
    メンテナンスエンドポイント）を追加

- 427641c: `examples/cloudflare-react-router` を v2 API から v3 API（`@notion-headless-cms/cms`）へ書き直した。

  - Durable Object は使わず、`createNodeSyncScheduler()` + `ensureSynced()`（`cms.sync.kick()`
    を cursor が尽きるまでループする、`examples/cloudflare-astro` と同じパターン）で同期する。
    KV（`DOC_CACHE`）/R2（`IMG_BUCKET`）は引き続き永続ストアとして使う
  - `post.notionBlocks()` + `buildPageLinkMap(cms)` を `denormalizeBlocks`/`toPageLinkMap`
    （`@notion-headless-cms/react-renderer/v3`）に置換
  - `<NotionRevalidator poll>` を引数なしの `useNotionRevalidate()`
    （`@notion-headless-cms/react-renderer/router`、mount / 再フォーカス時に直接 revalidate）
    に置換。WebSocket によるリアルタイム push は行わない
  - `cms.handler()` を `cms.fetch(request)` に統合
  - v2 の `find(slug, { force })`（明示リロード時の強制再取得）は v3 の `find()` に相当
    オプションが無いため廃止。README の該当記述も削除した
  - Node.js からの KV プリウォームスクリプト（`scripts/warm-kv.ts`）は削除。
    `/api/warm` を叩くと `ensureSynced()` でその場の isolate の同期を完了させる

- a5c23f3: `examples/minimal-node`・`examples/node-hono`・`examples/node-express` を v2 API
  （`@notion-headless-cms/client`）から v3 API（`@notion-headless-cms/cms`）へ書き直した。

  - codegen（`nhc generate`）を廃止し、`src/schema.ts` に `defineCollection`/`defineSchema`
    を直接書く方式に統一
  - `post.html()`/`post.markdown()`（関数を剥がす儀式）を廃止し、`cms.posts.find()` が返す
    プレーンな `EntrySnapshot`（`post.blocks`）をそのまま使う。HTML 化が必要な場合は
    `renderBlocksToHtml`（`@notion-headless-cms/cms/html`）を使う
  - webhook・画像プロキシ・OGP 等の個別配線を `cms.fetch(request)` 1 本に統合
  - `node-express` は Fetch API を話さないため、`Request`/`Response` 変換アダプタ
    （`src/lib/web-adapter.ts`）を追加した
  - 一括同期スクリプト向けに `cms.sync.kick()` を `cursor` が尽きるまでループする
    パターンを導入（chunked sync は元々 Workers の Alarm 継続を想定した設計のため）
  - `minimal-node`/`node-hono` の `src/schema.ts` はスキーマキー（英語）が実際の Notion
    プロパティ名（日本語）と食い違っており記事が一切取得できていなかった。`prop.*("実プロパティ名")`
    の別名指定（`@notion-headless-cms/cms` に新規追加）で修正した

- c89d8c0: スキーマのプロパティキーと実際の Notion プロパティ名が食い違う場合に値が取得できなかった不具合を修正した。

  - `@notion-headless-cms/cms`: `prop.*()` ビルダーが末尾引数で実際の Notion プロパティ名を受け取れるようになった（例: `prop.title("名前")`）。`mapProperties()`・`notion-driver.ts` の `slugOf()`/`statusOf()` がこの別名で `raw` プロパティを解決するよう修正
  - `@notion-headless-cms/cli`: `nhc.config.ts` の `v3.collections[].fieldMappings` を追加。`nhc pull` が明示マッピングまたは自動フォールバック識別子に対して `notion` 別名を生成コードへ埋め込むようになり、`nhc check` も同じ解決順で drift を照合する

- 3b29159: Cloudflare Durable Object として実際に `wrangler.toml` から binding できる
  `SyncCoordinatorDO`/`RealtimeHubDO` を追加した（S6/#443 で未実装だった「DO クラスを
  export する規約」の実施）。

  - `RealtimeHubDO`（`@notion-headless-cms/cms/cloudflare`）: v2 の `RealtimeHubDO` を移植。
    WebSocket Hibernation で購読を受理し、`durableObjectRealtime()` からの broadcast を
    channel tag 別に配信する
  - `createSyncCoordinatorDO()`: 利用者提供の `createCMS(state, env)` ファクトリから DO クラスを
    生成する。`alarm()` 発火ごとに CMS を再構築して `kick()` を呼ぶ（DO インスタンスの
    エビクトに対応）。`/kick` `/webhook` `/reconcile` `/state` `/stats` の内部エンドポイントを持つ
  - `durableObjectSyncDelegate(stub)`: 読者用の stateless Worker から DO へ sync 制御を
    転送するクライアント側ヘルパー
  - `createCMS()` に `realtime`（同期完了時に version 同梱で WebSocket push、#437 ADR-5。
    これまで `publishVersionUpdate` は実装済みだったがどこからも呼ばれていなかった）と
    `syncDelegate`（sync 制御を DO 等の外部に委譲する差し替え口。指定時は `notion`/`scheduler`
    が不要になる）を追加した

- 1b24228: `examples/vercel-nextjs` を v2 API から v3 API（`@notion-headless-cms/cms`）へ書き直した。

  - `createNextHandler`/`createNextWebhookHandler`（2 種併用）を `cms.fetch()` 1 本 +
    `revalidatePath` 呼び出し専用の webhook route（Next.js の `after()` でレスポンス確定後に
    ISR キャッシュを掃く）に統合
  - `post.markdown()` + `fetch-markdown/react` の `<Renderer>` を、`denormalizeBlocks`/
    `toPageLinkMap`（`@notion-headless-cms/react-renderer/v3`）+ 既存の `<NotionRenderer>` に置換
  - Vercel の serverless/edge 関数はインスタンス間でメモリを共有しないため、in-memory store は
    コールドスタートごとに再同期が必要という制約を明記した（`ensureSynced()` ヘルパー）
  - `app/schema.ts` はスキーマキー（英語）が実際の Notion プロパティ名（日本語）と食い違って
    おり記事が一切取得できていなかった。`prop.*("実プロパティ名")` の別名指定
    （`@notion-headless-cms/cms` に新規追加）で修正した
  - `<NotionRenderer>` に `ogpEndpoint="/api/cms/ogp"` を追加。埋め込みリンクの OGP サムネイル
    取得（`useOgp`）がクライアント側で発火していなかった不具合を修正した
  - `app/lib/cms.ts` の `createCMS()` 呼び出しをトップレベルの eager 実行から `getCms()` に
    よる遅延初期化へ変更。`next build` はルートハンドラ静的解析のためモジュールを import する
    だけで実行はしないが、`NOTION_TOKEN` 未設定のビルド環境（CI 等）ではその import だけで
    ビルドが失敗していた（`schema/notion_config_missing`）。トップレベルの `HomePage` も
    `generateStaticParams` と同様に取得失敗時は空一覧へフォールバックするようにした
