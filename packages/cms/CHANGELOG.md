# @notion-headless-cms/cms

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
    プレーンな `EntrySnapshot`（`post.blocks`）をそのまま使う。HTML化が必要な場合は
    `renderBlocksToHtml`（`@notion-headless-cms/cms/html`）を使う
  - webhook・画像プロキシ・OGP 等の個別配線を `cms.fetch(request)` 1本に統合
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

  - `createNextHandler`/`createNextWebhookHandler`（2種併用）を `cms.fetch()` 1本 +
    `revalidatePath` 呼び出し専用の webhook route（Next.js の `after()` でレスポンス確定後に
    ISR キャッシュを掃く）に統合
  - `post.markdown()` + `fetch-markdown/react` の `<Renderer>` を、`denormalizeBlocks`/
    `toPageLinkMap`（`@notion-headless-cms/react-renderer/v3`）+ 既存の `<NotionRenderer>` に置換
  - Vercel の serverless/edge 関数はインスタンス間でメモリを共有しないため、in-memory store は
    コールドスタートごとに再同期が必要という制約を明記した（`ensureSynced()` ヘルパー）
  - `app/schema.ts` はスキーマキー（英語）が実際の Notion プロパティ名（日本語）と食い違って
    おり記事が一切取得できていなかった。`prop.*("実プロパティ名")` の別名指定
    （`@notion-headless-cms/cms` に新規追加）で修正した
  - `<NotionRenderer>` に `ogpEndpoint="/api/cms/ogp"` を追加。埋め込みリンクのOGPサムネイル
    取得（`useOgp`）がクライアント側で発火していなかった不具合を修正した
  - `app/lib/cms.ts` の `createCMS()` 呼び出しをトップレベルの eager 実行から `getCms()` に
    よる遅延初期化へ変更。`next build` はルートハンドラ静的解析のためモジュールを import する
    だけで実行はしないが、`NOTION_TOKEN` 未設定のビルド環境（CI 等）ではその import だけで
    ビルドが失敗していた（`schema/notion_config_missing`）。トップレベルの `HomePage` も
    `generateStaticParams` と同様に取得失敗時は空一覧へフォールバックするようにした
