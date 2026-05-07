# @notion-headless-cms/notion-orm

> **内部利用向けパッケージ** — npm に公開されるが、ユーザーは直接 import しない。
> `@notion-headless-cms/notion-source` の `dependencies` として同梱されるため、利用側で明示インストールする必要もない。

Notion API を叩いて `@notion-headless-cms/core` の `DataSource<T>` を返す ORM 層。`createNotionCollection()` でページ取得・Markdown 変換を行う。

## 位置付け

```
ユーザーコード
    └─ createClient({ sources: { notion: notionSource(...) } })   ← core
         └─ notionSource({ schema, token })   ← notion-source
              └─ createNotionCollection({ token, dataSourceId, properties })   ← notion-orm
                   └─ @notionhq/client / zod / 内部 fetcher / transformer
```

ユーザー空間からは `notionSource()` (`notion-source` パッケージ) しか見えず、`@notion-headless-cms/notion-orm` を直接 import する必要はない。

## 公開 API (notion-source からのみ呼ばれる)

- `createNotionCollection(opts)` — `DataSource<T>` を返す
- `defineSchema(zodSchema, mapping)` — 宣言的スキーマを構築
- `defineMapping(mapping)` — プロパティ名マッピング

## ユーザーが直接呼ぶ公開 API

- `fetchBlockTree(client, pageId): Promise<NotionBlockTreeNode[]>` — ページ配下の全ブロックを `has_children` を再帰展開した木として返す。`@notion-headless-cms/react-renderer` の `<NotionRenderer blocks={...} />` の入力に使う
- `NotionBlockTreeNode` — `BlockObjectResponse & { children?: NotionBlockTreeNode[] }`

```ts
import { Client } from "@notionhq/client";
import { fetchBlockTree } from "@notion-headless-cms/notion-orm";

const client = new Client({ auth: process.env.NOTION_TOKEN });
const blocks = await fetchBlockTree(client, pageId);
```

## なぜ「直接 import しない」設計か

- ユーザーが直接 ORM レイヤーを触る必要はない (CLI が隠蔽する)
- 生成物経由に揃えることで Notion API の差分を吸収しやすい
- 将来 `googledocs-orm` 等を追加する際に抽象を変更しやすい

npm には公開されるので、別リポジトリから
`pnpm add @notion-headless-cms/notion-orm` でインストールできる
(インストール後、`import` は CLI 生成物経由で行う)。

## 関連

- [`@notion-headless-cms/core`](../core) — `createClient` / `DataSource` 型
- [`@notion-headless-cms/notion-source`](../notion-source) — `notionSource()` で本パッケージをラップする
- [`@notion-headless-cms/cli`](../cli) — `nhc generate` が `schema` を生成
