---
"@notion-headless-cms/core": patch
---

foreground の取得失敗と画像プロキシ 404 を logger に出すようにした

- `find()` / `list()` / `check()` などユーザー応答に直結する取得がリトライ枯渇後にハード失敗した場合、`logger.error("foreground 取得に失敗", { operation, collection, slug?, code })` を出力する（SWR バックグラウンド更新は従来どおり fail-soft の `warn` のみで、二重出力しない）。
- 画像プロキシ（`handler` の `GET {basePath}/images/:hash`）でハッシュがキャッシュに無く 404 を返す際に `logger.warn("画像プロキシ: ハッシュ未ヒット", { operation: "handler.image", imageHash, status: 404 })` を出力する。

Cloudflare Workers などで `logger` を設定していれば、Notion 取得失敗や期限切れ画像の取り逃しをダッシュボードのログで監視できる。
