# @notion-headless-cms/notion-orm

> **内部利用向けパッケージ** — npm に公開されるが、ユーザーは直接 import しない。
> `nhc generate` が生成する `nhc-schema.ts` から参照される ORM 層。
> 利用側プロジェクトは依存として本パッケージをインストールするだけで、
> import は生成物経由になる。

Notion API を叩いて `@notion-headless-cms/core` の `DataSource<T>` を
返す ORM 層。`createNotionCollection()` でページ取得・Markdown 変換を行う。

## 位置付け

```
ユーザーコード
    └─ createCMS({ dataSources: cmsDataSources })   ← core
         └─ cmsDataSources (nhc-schema.ts に自動生成)
              └─ createNotionCollection({ token, dataSourceId, schema })   ← notion-orm
                   └─ @notionhq/client / zod / 内部 fetcher / transformer
```

ユーザー空間からは `cmsDataSources` (CLI 生成物) しか見えず、
`@notion-headless-cms/notion-orm` を直接 import する必要はない。

## 公開 API (CLI 生成物のみから呼ばれる)

- `createNotionCollection(opts)` — `DataSource<T>` を返す
- `defineSchema(zodSchema, mapping)` — 宣言的スキーマを構築
- `defineMapping(mapping)` — プロパティ名マッピング

CLI が生成する `nhc-schema.ts` はこれらを透過的に呼び出す。

## なぜ「直接 import しない」設計か

- ユーザーが直接 ORM レイヤーを触る必要はない (CLI が隠蔽する)
- 生成物経由に揃えることで Notion API の差分を吸収しやすい
- 将来 `googledocs-orm` 等を追加する際に抽象を変更しやすい

npm には公開されるので、別リポジトリから
`pnpm add @notion-headless-cms/notion-orm` でインストールできる
(インストール後、`import` は CLI 生成物経由で行う)。

## 関連

- `@notion-headless-cms/core` — `createCMS` / `DataSource` 型
- `@notion-headless-cms/cli` — `nhc generate` が `cmsDataSources` を生成
