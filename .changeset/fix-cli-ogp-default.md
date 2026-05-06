---
"@notion-headless-cms/cli": patch
---

OGP設定の矛盾を修正: 生成コードの `ogp` を省略時に非取得とする

`config.ogp ?? { enabled: true }` が `FetchBlockTreeOgpOptions.enabled`（既定 false）および
`NotionCollectionCommonOptions.ogp`（省略時は OGP 非取得）と矛盾していた。
生成テンプレートを `ogp: config.ogp` に変更し、省略時は OGP を取得しない挙動に統一した。

OGP を有効にするには `nhc.config.ts` で明示的に設定を追加する必要があります：

```ts
// nhc.config.ts は変更不要
// createCMS を呼ぶ側で ogp を指定する
const cms = createCMS({
  notionToken: process.env.NOTION_TOKEN!,
  ogp: { enabled: true },
});
```
