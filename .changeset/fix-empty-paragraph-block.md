---
"@notion-headless-cms/block-html": patch
"@notion-headless-cms/react-renderer": patch
---

空の paragraph ブロックを空行として表示する

rich_text が空の paragraph が `<p></p>` になりブラウザが折り畳んでいた問題を修正。
block-html は `<p><br></p>`、react-renderer は `<br />` を挿入して 1 行分の高さを確保する。
