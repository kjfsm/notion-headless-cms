---
"@notion-headless-cms/react-renderer": patch
---

ブックマーク（OgCard）の横方向見切れを修正: カードに `min-h-[6.5rem]` を付与し、タイトル / 説明を `line-clamp-2 break-words` で折り返し・省略するよう調整。画像エリアも `w-28 sm:w-40 md:w-56` と段階縮小して、狭い幅で本文が圧迫されないようにした
