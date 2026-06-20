---
"@notion-headless-cms/core": patch
"@notion-headless-cms/client": patch
"@notion-headless-cms/cache": patch
"@notion-headless-cms/react-renderer": patch
---

更新検知を Notion 実データ基準に再設計した（破壊的変更）。

- `SWRConfig`: `ttlMs` を廃止し、`recheckWindowMs`（Notion 再照会の最小間隔=coalescing、既定 30 秒）と `staleBlockMs`（ブロック閾値、未指定時は webhook secret あり→無期限／なし→7 日）に分離。
- `find()` は「新しければ即キャッシュ表示＋裏で Notion 突合（recheck ウィンドウ内は照会しない＝複数端末を集約）／古ければブロッキング再取得」になり、`FindOptions.force` で明示リロード時にウィンドウを無視して最新を取得できる。
- Handler: 副作用付き GET だった `GET /versions` を廃止し、`POST /check/{collection}/{slug}?v=&force=` に一本化（Notion を coalescing 付きで実照会し `{ stale, version }` を返す）。`HandlerAdapter.peekVersionFor` と `CollectionClient.peekVersion` を削除。
- `<NotionRevalidator>`: ポーリングを廃止し、mount／再フォーカス契機で `POST /check` を叩き `stale` のときだけ revalidate する方式へ。`realtime`（Durable Object）設定時はポーリングを停止し WebSocket push を主経路にする。
- 新規 `isReloadRequest(req)` を `@notion-headless-cms/client` から提供（`Cache-Control: no-cache`/`max-age=0` を検出）。SSR ローダーで `find(slug, { force: isReloadRequest(request) })` に使う。
