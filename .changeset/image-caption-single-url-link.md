---
"@notion-headless-cms/block-html": patch
"@notion-headless-cms/react-renderer": patch
---

画像の caption が単一の URL のみで構成される場合、画像全体をそのリンクで包むようにした（caption テキストは表示しない）。Notion API の image ブロックには画像自体のリンクを表すフィールドが無いため、caption に URL だけを入れる規約でクリック可能な画像を表現する。説明テキスト付きリンクや複数要素の caption は従来どおり figcaption として描画する。
