# @notion-headless-cms/notion-orm

> **Internal package** — npm には公開されない。`private: true`。
> ユーザーは直接 import しない。`nhc generate` が生成する `nhc-schema.ts`
> から参照される内部実装。

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
- `notionAdapter(opts)` — `createNotionCollection` の旧名エイリアス (非推奨)
- `defineSchema(zodSchema, mapping)` — 宣言的スキーマを構築
- `defineMapping(mapping)` — プロパティ名マッピング

CLI が生成する `nhc-schema.ts` はこれらを透過的に呼び出す。

## なぜ internal か

- ユーザーが直接 ORM レイヤーを触る必要はないため (CLI が隠蔽する)
- Notion API 依存を user の package.json に露出させないため
- 将来 `googledocs-orm` 等を追加する際に抽象を変更しやすいため

## 関連

- `@notion-headless-cms/core` — `createCMS` / `DataSource` 型
- `@notion-headless-cms/cli` — `nhc generate` が `cmsDataSources` を生成
