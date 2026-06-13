---
"@notion-headless-cms/react-renderer": patch
---

README の `notionBlocks()` 利用例を `createCMS({ render: { content: "react" } })` のキャスト不要パターンに更新。`as NotionBlock[]` キャストが必要なのは低レベル `createClient` 経由の場合のみであることを明記する（docs/ja/api/cms-methods.md にも同趣旨を追記）。
