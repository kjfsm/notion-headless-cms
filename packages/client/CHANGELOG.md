# @notion-headless-cms/client

## 0.2.0

### Minor Changes

- 2ba1214: **メジャーアップデート（破壊的変更）**: 使い勝手をコンセプトから再設計し、単一エントリ `@notion-headless-cms/client` に集約した（RFC: `docs/ja/rfc/v2-usability-redesign.md`）。

  - **単一エントリ `createCMS`**: `createClient` + `notionSource` + preset の 3 合成を 1 呼び出しに集約。`schema`(構造) と `token`/`content`/`collections`/`runtime`(振る舞い) を分離
  - **content モード**: `"html"` / `"react"` の単一決定で取得戦略と renderer を内部結線し、不整合フットガンを排除。アイテム本文アクセサ型も mode で分岐（`notionBlocks()` の `undefined` を型で排除）
  - **status 値の型安全**: `published` / `accessible` を schema の status options から literal union で型付け
  - **サブパス集約**: `./next`（`createNextHandler` / `nextPreset`）、`./cloudflare`（`cloudflarePreset` / `restKvCache`）、`./react`（`Renderer` / `NotionRevalidator`）
  - **単一インストール**: `@notionhq/client` / `zod` / `notion-to-md` を依存に取り込み `pnpm add @notion-headless-cms/client` だけで動く
  - **メタパッケージ廃止（破壊的）**: `@notion-headless-cms/node` / `@notion-headless-cms/cloudflare` / `@notion-headless-cms/next` を削除。`@notion-headless-cms/client` (+ サブパス) へ移行する
  - **CLI**: `nhc init` テンプレートを `createCMS` ベースに更新。公開ステータスは config から外し `createCMS({ collections })` 側へ

### Patch Changes

- Updated dependencies [6478628]
- Updated dependencies [e9698a3]
- Updated dependencies [054e3d6]
- Updated dependencies [12ddf52]
- Updated dependencies [f7f0493]
- Updated dependencies [4183d36]
- Updated dependencies [3f8bd02]
- Updated dependencies [6478628]
- Updated dependencies [2d6b5b8]
- Updated dependencies [355f3e1]
- Updated dependencies [6e1cec6]
  - @notion-headless-cms/core@0.5.0
  - @notion-headless-cms/cache@0.1.0
  - @notion-headless-cms/notion-source@0.2.1
  - @notion-headless-cms/react-renderer@0.1.13
  - @notion-headless-cms/fetch-blocks@0.0.4
  - @notion-headless-cms/fetch-markdown@0.0.4
