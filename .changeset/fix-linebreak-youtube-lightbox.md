---
"@notion-headless-cms/react-renderer": patch
"@notion-headless-cms/block-html": patch
---

ブロック内改行・YouTube埋め込み・画像ライトボックスを修正

- RichText の `\n` を `<br>` に変換（#256）
- Video/Embed の YouTube URL を `youtube-nocookie.com/embed/` 形式に変換し接続拒否を解消（#257）
- Image クリックでライトボックス表示（ESC・背景クリックで閉じる）（#258）
