# トラブルシューティング

利用時に遭遇しやすい問題と切り分け手順をまとめます。エラーコード詳細は
[`docs/ja/errors/index.md`](./errors/index.md) を参照してください。

---

## レート制限 (Notion API 429)

### 症状

- `source/fetch_items_failed` / `source/fetch_item_failed` が一定間隔で発生
- ログに `list() リトライ中` `find() リトライ中` が並ぶ

### 原因

Notion API は 1 秒あたり 3 リクエスト程度のハード制限があります。`warm` で多数の
ページを並列に取得したり、フロント側で短時間に何度も staleBlockMs 超過のキャッシュにアクセスすると
429 が連続発生します。

### 対処

1. `createClient({ rateLimiter: { maxConcurrent, maxRetries, baseDelayMs, retryOn } })` を設定。
   既定値は `DEFAULT_RATE_LIMITER` を参照 (`maxConcurrent: 3`, `retryOn: [429, 502, 503]`,
   `maxRetries: 4`, `baseDelayMs: 1000`)
2. `swr.recheckWindowMs` を長めにして Notion 再照会の集約間隔を広げる（webhook 稼働時は `staleBlockMs` 既定の無期限のままにし、ブロッキング再取得を起こさない）
3. `cms.posts.warm({ concurrency: 1 })` で warm 時の並列度を絞る
4. Cloudflare では `cache.waitUntil` に `(p) => ctx.waitUntil(p)` を必ず渡し、SWR バックグラウンド
   更新を `waitUntil` 経由でレスポンス送信後に逃がす

---

## Webhook 署名検証失敗 (`webhook/signature_invalid`)

### 症状

`cms.parseWebhookFor(req, { secret })` または `createNextWebhookHandler` が
401 を返す / `webhook/signature_invalid` を throw する。

### 原因

- Notion 側の Webhook secret と環境変数 (`NOTION_WEBHOOK_SECRET` 等) の値が不一致
- リバースプロキシで raw body が改変されている (例: gzip 解除前にヘッダのみ転送)
- request body の文字エンコーディングが不一致

### 対処

1. `secret` の値を 1 文字ずつ確認 (前後のスペース・改行に注意)
2. プロキシで raw body が壊れていないか確認 (`request.text()` の生バイトを使う)
3. Notion 管理画面の Webhook 設定で「Send sample event」を実行し、ローカルで再現

---

## `staleBlockMs` / `recheckWindowMs` と `updatedAt` の優先度

### 仕様

`createClient` の SWR は以下の順で判定します:

1. `cachedAt + staleBlockMs < now` ? → ブロック閾値超過 → **ブロッキングで再フェッチ** (古すぎるデータは返さない)。webhook secret 設定時の既定は無期限のため、ここには入らず常に即表示
2. 閾値以内 → **即キャッシュ表示**。`cachedAt + recheckWindowMs < now`（recheck ウィンドウ経過）のときだけバックグラウンドで Notion の `last_edited_time` と比較。ウィンドウ内なら照会しない（coalescing）
3. 差分があれば再フェッチして HTML を再生成、`onCacheRevalidated` フックを呼ぶ

### よくある誤解

- `staleBlockMs` 超過でも「とりあえず古い値を返す」ことはしません。これは `core/cms.ts` 設計の明示的な
  仕様です ([CLAUDE.md 設計方針]) 。秒間レイテンシより整合性を優先したい用途に向きます
- `recheckWindowMs`（既定 30 秒）内は、裏側の突合でも Notion を再照会しません。複数端末・連続アクセスを 1 回の照会に集約するためです
- Webhook 経由の `invalidate` / `warm` は即時です。**recheck ウィンドウや閾値を無視して即座に最新化させるには** `find(slug, { bypassCache: true })`（強制ブロッキング再取得 + 本文キャッシュ破棄）または `find(slug, { force: true })`（ウィンドウ無視で実照会）を使ってください

---

## Cloudflare KV / R2 binding 不整合 (`cache/io_failed`)

### 症状

- Workers で起動直後に `cache/io_failed` が連続発生
- `error.context.binding` に未定義 (undefined) が入っている

### 対処

1. `wrangler.toml` の `kv_namespaces` と `r2_buckets` の binding 名を確認
   (既定: `DOC_CACHE`, `IMG_BUCKET`)
2. `kvCache({ namespace: env.DOC_CACHE })` / `r2Cache({ bucket: env.IMG_BUCKET })` に渡す
   `env` が、wrangler が注入する `env` と同一オブジェクトか確認
3. ローカル開発では `wrangler dev` (miniflare 経由) で binding が解決される。`pnpm dev`
   で素の Node を使うと binding は undefined のまま

---

## 画像が出ない (`cache/image_fetch_failed`)

### 原因

- Notion 署名 URL が約 1 時間で失効するため、サーバー側で `cacheImage` を介して
  プロキシ URL に置換しないと、フロントが古い URL で読み込みエラーになる
- `imageProxyBase` (既定 `/api/images`) のルートが Next.js / hono ルータに登録されていない

### 対処

1. `createNextHandler(cms, { ... })` または `createHandler({ imageRoute: "/api/images" })` を
   サーバー側に必ず登録する
2. React 側では `resolveBlockImageUrls(blocks, cms.cacheImage)` を await してから `<NotionRenderer>` に渡す
3. R2 / KV bucket の容量上限と CORS 設定を確認

---

## さらなる問い合わせ

- エラーコード辞書: [`docs/ja/errors/index.md`](./errors/index.md)
- 各メソッドの仕様: [`docs/ja/api/cms-methods.md`](./api/cms-methods.md)
- アーキテクチャ背景: [`docs/ja/architecture.md`](./architecture.md)
