# @notion-headless-cms/renderer

Markdown → HTML レンダラー。remark / rehype（unified）パイプラインで変換する。
GFM（テーブル / 打ち消し線など）と Notion 画像 URL のプロキシ書き換えをデフォルトでサポートする。

## インストール

```bash
npm install @notion-headless-cms/renderer \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
```

`unified` / `remark-*` / `rehype-*` は `peerDependencies`。複数バージョン同居による unified の `Processor` インスタンス不一致を避けるため、利用側のアプリが明示的にインストールする。

通常は [`@notion-headless-cms/core`](../core) の `createCMS()` 経由で使う。
renderer は未指定の場合、core が動的 import でフォールバック注入する。
明示的に差し替えたい場合は `nodePreset({ renderer: renderMarkdown })` や
`createCMS({ renderer: renderMarkdown, ... })` で注入する。

## 使い方

```typescript
import { renderMarkdown } from "@notion-headless-cms/renderer";

const html = await renderMarkdown("# Hello\n\nWorld");
// "<h1>Hello</h1>\n<p>World</p>"
```

### 画像プロキシ

Notion 画像 URL は期限付きのため、`cacheImage` を渡せば画像を永続ストレージに保存した上でプロキシ URL に書き換えられる。`core` 内部ではキャッシュと連携した `cacheImage` が自動注入される。

```typescript
import { renderMarkdown } from "@notion-headless-cms/renderer";

const html = await renderMarkdown(markdown, {
  imageProxyBase: "/api/images",
  cacheImage: async (notionUrl) => {
    const hash = await storeAndHash(notionUrl);
    return `/api/images/${hash}`;
  },
});
```

### 追加のプラグイン

```typescript
import rehypeHighlight from "rehype-highlight";
import type { PluggableList } from "@notion-headless-cms/renderer";
import { renderMarkdown } from "@notion-headless-cms/renderer";

const rehypePlugins: PluggableList = [rehypeHighlight];

const html = await renderMarkdown(markdown, {
  rehypePlugins,
});
```

`PluggableList` は `unified` の公開型を再エクスポートしたもの。`core` 側の `RenderOptions.remarkPlugins` / `rehypePlugins` も同じ型。

### パイプラインを完全置き換え

`render` を渡すと remark/rehype パイプラインを使わず独自の実装に差し替えられる。

```typescript
import type { RendererFn } from "@notion-headless-cms/renderer";
import { renderMarkdown } from "@notion-headless-cms/renderer";

const myRenderer: RendererFn = async (markdown) => `<pre>${markdown}</pre>`;

const html = await renderMarkdown(markdown, { render: myRenderer });
```

## API

### `renderMarkdown(markdown, options?): Promise<string>`

| オプション | 型 | 説明 |
|---|---|---|
| `imageProxyBase` | `string` | 画像プロキシのベース URL（デフォルト: `/api/images`） |
| `cacheImage` | `(notionUrl: string) => Promise<string>` | Notion 画像 URL を永続化して URL を返す関数。未指定時は URL をそのまま使う |
| `remarkPlugins` | `PluggableList` | 追加する remark プラグイン |
| `rehypePlugins` | `PluggableList` | 追加する rehype プラグイン |
| `render` | `RendererFn` | デフォルトパイプラインを置き換えるカスタムレンダラー |

### 型

- `RendererFn` — `(markdown, options?) => Promise<string>`。core の `RendererFn` と構造的互換。
- `RendererOptions` — `renderMarkdown` のオプション型。
- `PluggableList` — `unified` の再エクスポート。`remarkPlugins` / `rehypePlugins` の型。

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン
- [`@notion-headless-cms/notion-orm`](../notion-orm) — Notion データソース (internal)
