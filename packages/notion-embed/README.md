# @notion-headless-cms/notion-embed

Notion の `embed` / `bookmark` / `video` / `audio` / `pdf` / `link_preview` / `link_to_page` ブロックを HTML に変換し、安全にレンダリングするための拡張パッケージ。

- **BlockHandler** を `@notion-headless-cms/notion-orm` の `blocks` オプションに渡せる
- **Provider レジストリ** で URL ごとに任意の HTML（`<iframe>` / `<a>` / OGP カード等）を生成
- **rehype プラグイン** で `rehype-raw` + `rehype-sanitize` をスキーマ拡張付きでまとめて適用
- 各 provider が `sanitizeSchema` を持つため、**provider 追加 = sanitize 拡張 = レンダー可能**

## インストール

```bash
pnpm add @notion-headless-cms/embeds rehype-raw rehype-sanitize hast-util-sanitize
```

## 使い方

```ts
import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { renderMarkdown } from "@notion-headless-cms/renderer";
import {
  createEmbedHandlers,
  embedRehypePlugins,
  steamProvider,
  dlsiteProvider,
  youtubeProvider,
} from "@notion-headless-cms/embeds";

const providers = [steamProvider(), dlsiteProvider(), youtubeProvider()];
const handlers = createEmbedHandlers({ providers });

export const cms = createCMS({
  ...nodePreset({
    renderer: (md, opts) =>
      renderMarkdown(md, {
        ...opts,
        allowDangerousHtml: true,
        rehypePlugins: embedRehypePlugins({ providers }),
      }),
  }),
  dataSources: {
    posts: notionCollection({
      // ... CLI 生成の properties
      blocks: handlers,
    }),
  },
});
```

## カスタム provider

```ts
import { defineEmbedProvider } from "@notion-headless-cms/embeds/providers";

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

## エラー

| コード | 用途 |
|---|---|
| `embeds/render_failed` | provider.render が throw した |
| `embeds/provider_not_matched` | strict モードで未マッチ URL を検知 |

## ライセンス

MIT
