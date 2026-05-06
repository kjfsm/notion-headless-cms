---
"@notion-headless-cms/notion-embed": minor
"@notion-headless-cms/react-renderer": minor
---

`@notionhq/client` の `BlockObjectResponse` union 全 type に対応した。

- `notion-embed`: `heading_4` / `code` / `equation` / `divider` / `breadcrumb` / `table` / `table_row` / `table_of_contents` / `tab` / `column_list` / `column` / `synced_block` / `template` / `child_page` / `child_database` / `meeting_notes` / `transcription` / `unsupported` の 18 種類を追加。`createBlockHandlers` の戻り値型を `Record<BlockObjectResponse["type"], BlockHandler>` に固定し、`@notionhq/client` で新しい block type が追加された場合は型エラーで検知できる。
- `react-renderer`: `Heading` コンポーネントを `heading_4` にも対応させ、`BlockSwitch` の dispatcher を `satisfies Record<BlockObjectResponse["type"], unknown>` 付き map に置換。ライブラリ更新で union が増えたら typecheck で気付ける。`ComponentOverrides` に `TableRow` / `Tab` / `Template` / `MeetingNotes` / `Transcription` の override スロットを追加。
- Issue #208: discriminated union が既に narrowing 済みの 3 箇所 (`callout.ts` の `"file" in icon`、`render-rich-text.ts` の user mention `"name" in u` および custom_emoji の `"url" in emoji`) を冗長な `"in"` 演算子チェックを除去するリファクタリング。
