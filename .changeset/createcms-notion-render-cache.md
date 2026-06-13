---
"@notion-headless-cms/client": patch
---

`createCMS()` の引数をデータの流れ「取得 → 表現 → 永続化」に沿って 3 グループへ再編（破壊的変更）。`schema` / `token` / `collections` を `notion`、`content` / `imageProxyBase` / `ogp` を `render`、キャッシュ配線を `cache` に集約する。旧 `runtime` フィールドは廃止し、`cache` は `document` / `image` の役割別にアダプタ（`kvCache` / `r2Cache` / `memoryCache` / `nextCache`）を明示する形にした（`env` を丸ごと渡す不透明さを解消）。あわせて `client/cloudflare` から `kvCache` / `r2Cache`、`client/next` から `nextCache` を re-export し、explicit なキャッシュ構成を利用側から組み立てやすくする。
