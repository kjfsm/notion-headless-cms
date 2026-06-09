---
"@notion-headless-cms/client": patch
"@notion-headless-cms/fetch-blocks": patch
---

createCMS に `ogp` オプションを追加し、`content: "react"` で OGP リンクプレビューを既定オンにする

bookmark / link_preview / embed ブロックの OGP メタデータをサーバー側で取得してブロックに付与する（取得結果は既存のドキュメントキャッシュに同梱されるため追加のキャッシュ設定は不要）。OG 画像は既定で元 URL のまま流し、ブラウザが直接読み込む（R2 等への永続キャッシュなし）。`ogp: false` で無効化でき、`ogp: { enabled: true, imageCache }` を渡せば OG 画像の R2 永続化も選べる。`fetch-blocks` は利用側が型付きで設定を渡せるよう `FetchBlockTreeOgpOptions` を re-export する。
