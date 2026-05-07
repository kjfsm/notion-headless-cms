---
"@notion-headless-cms/react-renderer": patch
---

ブックマーク（OgCard）の横方向見切れを修正: カードに `min-h-[6.5rem]` を付与し、タイトル / 説明を `line-clamp-2 break-words` で折り返し・省略するよう調整。画像エリアは `w-36 sm:w-48 md:w-64` の段階縮小で狭い親幅でも本文が圧迫されないようにした
