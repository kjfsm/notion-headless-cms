# @notion-headless-cms/notion-embed

Notion の `embed` / `bookmark` / `video` / `audio` / `pdf` / `file` / `image` / `link_preview` / `link_to_page` ブロックを HTML に変換し、安全にレンダリングするための拡張パッケージ。

- **embed ブロック** → provider が一致すればその出力を使い、なければ `<iframe>` で直接表示
- **bookmark ブロック** → OGP カード（in-memory TTL キャッシュ付き）
- **Provider レジストリ** で URL ごとに任意の HTML（`<iframe>` / `<a>` 等）を生成
- **rehype プラグイン** で `rehype-raw` + `rehype-sanitize` をスキーマ拡張付きでまとめて適用
- 各 provider が `sanitizeSchema` を持つため、**provider 追加 = sanitize 拡張 = レンダー可能**

## インストール

```bash
pnpm add @notion-headless-cms/notion-embed
```

## 使い方

```ts
import { memoryCache } from "@notion-headless-cms/cache";
import { createClient } from "@notion-headless-cms/core";
import {
  notionEmbed,
  youtubeProvider,
} from "@notion-headless-cms/notion-embed";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./generated/nhc.schema";

const embed = notionEmbed({
  providers: [youtubeProvider({ display: "card" })],
});

export const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN!,
      blocks: embed.blocks,
    }),
  },
  renderer: embed.renderer,
  cache: [memoryCache()],
});
```

`notionEmbed()` は `renderer` と `blocks` を返す。`renderer` は `createClient` 直下に、`blocks` は `notionSource` の `blocks` オプションに渡す。

### embed ブロックの挙動

1. 登録済み provider が URL に一致 → provider が返す HTML を使う
2. 一致しない → URL を `src` に持つ `<iframe>` を直接出力

```html
<!-- 例: https://store.steampowered.com/widget/2868840/ -->
<div class="nhc-embed">
  <iframe src="https://store.steampowered.com/widget/2868840/" frameborder="0" loading="lazy"></iframe>
</div>
```

OGP カードにしたい場合は bookmark ブロックを使うこと。

## カスタム provider

```ts
import { defineEmbedProvider } from "@notion-headless-cms/notion-embed";

export const myProvider = defineEmbedProvider({
  id: "my-widget",
  match: (url) => url.startsWith("https://my-service.example.com/"),
  render: ({ url }) => ({
    kind: "html",
    html: `<iframe src="${url}" loading="lazy"></iframe>`,
  }),
  sanitizeSchema: {
    tagNames: ["iframe"],
    attributes: { iframe: ["src", "loading"] },
    protocols: { src: ["https"] },
  },
});
```

## ライセンス

MIT
