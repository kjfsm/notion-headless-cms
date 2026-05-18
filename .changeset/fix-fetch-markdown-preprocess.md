---
"@notion-headless-cms/fetch-markdown": patch
---

`</table>` や `<unknown/>` 直後の見出しが `<h2>` に変換されない問題を修正

CommonMark の HTML ブロックルール（Type 6/7）により、`</table>` や `<unknown .../>` の
直後に空行なしで `## ` が続くと見出しではなく HTML ブロックの中身として扱われていた。
`preprocess.ts` で `</table>` の後と `<unknown .../>` の前後に空行を挿入することで解消。
