---
"@notion-headless-cms/react-renderer": patch
---

Code ブロックから shiki 依存を削除し、シンタックスハイライトせず素の `<pre><code>` で描画するように変更。バンドルサイズを大幅に削減。言語名は `data-language` 属性で参照可能。
