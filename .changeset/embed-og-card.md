---
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/react-renderer": patch
---

embed/bookmark ブロックを OG 情報ベースの汎用カードに統一。`fetchBlockTree(client, pageId, { ogp: { enabled: true, imageCache } })` で OG メタデータを取得して各ブロックに `ogp` フィールドとして付与し、react-renderer 側は YouTube 以外をすべて画像入りリンクカード (`OgCard`) で描画する。Steam / DLsite / Twitter / Vimeo / 汎用 iframe 専用コンポーネントは廃止。
