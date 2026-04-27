# @notion-headless-cms/embeds

## 0.1.3

### Patch Changes

- 451b6fd: `rehype-sanitize` スキーマの HTML 属性名を HAST プロパティ名に修正（`frameborder`→`frameBorder`、`allowfullscreen`→`allowFullScreen`）。これにより YouTube・Vimeo・Steam・汎用 iframe の `frameborder` / `allowfullscreen` 属性が削除されなくなった。

## 0.1.2

### Patch Changes

- dffa33b: 埋め込みブロックの描画修正と oEmbed 採用

  - **iframe サニタイズ修正**: `iframe` タグが基本スキーマに含まれていなかったため PDF・CodePen などの埋め込みが空白になっていた問題を修正
  - **外部 MP4 動画**: 外部 URL の `video` ブロックで `.mp4/.webm/.ogg/.mov` は `<video>` タグで描画するよう変更
  - **YouTube card の oEmbed 採用**: YouTube はボット対策で OGP をブロックするため `fetchOgp` を廃止し oEmbed エンドポイントを使用。実際の動画タイトル・サムネイルが取得できるように
  - **YouTube / Vimeo の OGP/URL 解析コード削減**: Vimeo の `VIMEO_RE` 正規表現を oEmbed で置き換え
  - **OGP 失敗時のフォールバック**: `bookmark` ブロックで OGP 取得失敗時のタイトルを生 URL からホスト名に変更し、`nhc-bookmark--no-ogp` クラスを付与

- 17f4201: # CMS 再設計 (実装変更が大きい patch)

  API・パッケージ構成・CLI 生成物を全面的に作り直した。詳細は `docs/migration/v1.md` を参照。

  ## ハイライト

  - **`createCMS` の API を簡素化**:
    - 12 メソッド → 4 メソッド: `get` / `list` / `params` / `cache.{invalidate,warm,adjacent}`
    - `getItem` → `get`、`getList` → `list`、`getStaticParams` → `params`
    - `getItemMeta` / `getItemContent` / `getStaticPaths` / `checkForUpdate` / `checkListForUpdate` を削除 (SWR は内部で自動)
    - `prefetch` → `cache.warm`、`revalidate(All)` → `cache.invalidate`、`adjacent` → `cache.adjacent`
    - `cms.$revalidate(scope?)` → `cms.$invalidate(scope?)`
  - **戻り値の刷新**:
    - `get(slug)` は `T & { render(opts?) }` を返し、`render()` 呼び出し時に本文を遅延ロード
    - `result.content.html()/markdown()/blocks()` → `result.render({ format?: "html" \| "markdown" })`
    - `list()` は `T[]` を直接返す (旧 `{ items, version }` を廃止)
  - **キャッシュ統合 (`@notion-headless-cms/cache`)**:
    - `cache-r2` / `cache-kv` / `cache-next` を 1 パッケージに集約
    - `memoryCache()` (doc + image)、`r2Cache()` (image)、`kvCache()` (doc)、`cloudflareCache(env)` (KV+R2)、`nextCache()` (Next.js ISR)
    - `cache: CacheAdapter \| CacheAdapter[]` で柔軟に組み合わせ可能
    - `nodePreset` / `cloudflarePreset` を削除
  - **CLI が完全な `nhc.ts` を生成**:
    - 旧 `nhc-schema.ts` (型のみ) → 新 `nhc.ts` (型 + `createCMS` ファクトリ)
    - ユーザーは `import { createCMS } from "./generated/nhc"` で即座に使える
    - select / status のオプションが literal union 型として生成される
    - `nhc.config.ts` の `dataSources: [...]` → `collections: { posts: { ... } }`
  - **パフォーマンス改善**:
    - renderer の unified processor をモジュールスコープでメモ化 (再構築コスト削減)
    - 画像 URL → SHA-256 ハッシュをプロセス内 LRU でメモ化
  - **アーキテクチャ整理**:
    - `CacheAdapter` インターフェースを `handles` フィールドで doc / image に振り分け
    - `scopeDocumentCache` を廃止 (アダプタが直接 `(collection, slug)` を受け取る)
    - core は `CacheAdapter / DocumentCacheOps / ImageCacheOps` を公開、`DocumentCacheAdapter / ImageCacheAdapter` は削除

  ## 削除されたパッケージ

  - `@notion-headless-cms/cache-r2` → `@notion-headless-cms/cache/cloudflare` の `r2Cache`
  - `@notion-headless-cms/cache-kv` → `@notion-headless-cms/cache/cloudflare` の `kvCache`
  - `@notion-headless-cms/cache-next` → `@notion-headless-cms/cache/next` の `nextCache`

  ## 移行例

  ```ts
  // Before (v0.x)
  import { createCMS, nodePreset } from "@notion-headless-cms/core";
  import { cmsDataSources } from "./generated/nhc-schema";

  const cms = createCMS({
    ...nodePreset({ ttlMs: 5 * 60_000 }),
    dataSources: cmsDataSources,
    collections: { posts: { slug: "slug", publishedStatuses: ["公開済み"] } },
  });
  const { items } = await cms.posts.getList();
  const post = await cms.posts.getItem("hello");
  const html = await post?.content.html();

  // After (v1)
  import { createCMS } from "./generated/nhc";
  import { memoryCache } from "@notion-headless-cms/cache";

  const cms = createCMS({
    notionToken: process.env.NOTION_TOKEN!,
    cache: memoryCache(),
    ttlMs: 5 * 60_000,
  });
  const items = await cms.posts.list();
  const post = await cms.posts.get("hello");
  const html = await post?.render();
  ```

- Updated dependencies [17f4201]
  - @notion-headless-cms/renderer@0.1.6

## 0.1.1

### Patch Changes

- 2d88e56: YouTube 系コンテンツの 3 形態 (bookmark カード / link_mention 文字 / YouTube カード) を Notion 風に正しく描画できるように修正:

  - `renderRichText` の `mention.link_mention` が API レスポンスの `icon_url` / `link_provider` / `title` を使い、Notion 上のインラインリンクメンションと同等の `<img>` アイコン + プロバイダ名 + 太字タイトルを出力するようになった
  - `youtubeProvider` に `display: "iframe" | "card"` オプションを追加。`card` モードでは bookmark 風 OGP カード HTML を返す。動画 ID が抽出できないチャンネル URL 等も `card` に自動フォールバック
  - `renderBookmark` および YouTube card モードの出力を `<div class="nhc-bookmark-block">` でラップし、markdown 経由で `<p><a><div></div></a></p>` の構造が HTML5 パーサに分解されないように修正
  - rehype-sanitize の基本スキーマで `class` 属性を `className` に修正し、HAST との整合性を取りつつ deepMergeSchema を override 先頭挿入に変更。これにより `nhc-*` クラスが全て保持されるようになった (これまで `class=""` に空化されていた)

## 0.1.0

### Minor Changes

- e6d043b: 新パッケージ `@notion-headless-cms/notion-embed` を追加。

  Notion の各種ブロック（bookmark / embed / link_preview / video / audio / pdf / image / callout / toggle / paragraph / heading / list / quote / to_do）を Notion 風 HTML にレンダリングする。`notionEmbed()` を `createCMS()` の引数に差し込むだけで使える。

  - OGP カード（bookmark ブロック）のレンダリング（in-memory TTL キャッシュ付き）
  - rich_text の mention（link_mention / link_preview / page / database / date / user / custom_emoji）と全アノテーション対応
  - Steam / YouTube / Vimeo / Twitter / DLsite / generic iframe の embed プロバイダー
  - `rehype-raw` + `rehype-sanitize` をセットで返す `embedRehypePlugins()`

  `@notion-headless-cms/renderer` に `allowDangerousHtml` オプションを追加。

### Patch Changes

- Updated dependencies [e6d043b]
  - @notion-headless-cms/renderer@0.1.5
