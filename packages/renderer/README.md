# @kjfsm/notion-headless-cms-renderer

Markdown → HTML レンダラー。remark / rehype（unified）パイプラインで変換する。  
Notion 画像 URL のプロキシ書き換えと GFM（テーブル・打ち消し線など）をデフォルトでサポートする。

## インストール

```bash
npm install @kjfsm/notion-headless-cms-renderer
```

通常は [`@kjfsm/notion-headless-cms-core`](../core) 経由で利用される。

## 使い方

```typescript
import { createRenderer, renderMarkdown } from "@kjfsm/notion-headless-cms-renderer";

const renderer = createRenderer({
  imageProxyBase: "/api/images",
});

const html = await renderMarkdown(renderer, "# Hello\n\nWorld");
```

### カスタムプラグイン

```typescript
import rehypeHighlight from "rehype-highlight";

const renderer = createRenderer({
  rehypePlugins: [rehypeHighlight],
  imageProxyBase: "/api/images",
});
```

### カスタムレンダラー（パイプライン全置換）

```typescript
import type { RendererFn } from "@kjfsm/notion-headless-cms-renderer";

const myRenderer: RendererFn = async (markdown) => {
  // 独自のレンダリングロジック
  return `<div>${markdown}</div>`;
};

const renderer = createRenderer({ render: myRenderer });
```

## API

| エクスポート | 説明 |
|---|---|
| `createRenderer(options?)` | レンダラーを生成する |
| `renderMarkdown(renderer, markdown)` | Markdown 文字列を HTML に変換する |
| `RendererFn` | カスタムレンダラー関数の型 |

### `createRenderer` オプション

| オプション | 型 | 説明 |
|---|---|---|
| `imageProxyBase` | `string` | 画像プロキシのベース URL（デフォルト: `/api/images`） |
| `remarkPlugins` | `PluggableList` | 追加する remark プラグイン |
| `rehypePlugins` | `PluggableList` | 追加する rehype プラグイン |
| `render` | `RendererFn` | デフォルトパイプラインを置き換えるカスタムレンダラー |

## 関連パッケージ

- [`@kjfsm/notion-headless-cms-transformer`](../transformer) — Markdown 生成元
- [`@kjfsm/notion-headless-cms-core`](../core) — CMS エンジン（このパッケージを内部で使用）
