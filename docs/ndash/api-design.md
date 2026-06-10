# nDash 公開 API 設計

このドキュメントは nDash の公開 API の形をコード例で定義する。型の厳密な定義は実装時に詰めるが、**ここに書いた利用者コードの形を変えない**ことを目標にする。

## 0. 全体像（30 秒）

```ts
// 1. スキーマを TypeScript で書く（codegen 不要）
import { createDash, defineCollection, p } from "ndash";

const posts = defineCollection({
  database: "ブログ記事DB",          // DB 名 or ID
  slug: "slug",
  properties: {
    title: p.title(),
    status: p.status(["下書き", "公開済み"]),
    tags: p.multiSelect(),
    publishedAt: p.date(),
  },
  published: { status: ["公開済み"] },  // 公開ポリシーの住所はここ 1 箇所
});

// 2. エンジンを作る
export const dash = createDash({
  collections: { posts },
  token: env.NOTION_TOKEN,
  mount: "/api/ndash",   // images / webhook / preview の URL がここから導出される
  freshness: "fast",     // 既定。serve-stale + scheduled で 1 分以内反映
});

// 3. 使う — 戻り値は完全にシリアライズ可能なプレーンデータ
const page = await dash.posts.list({ limit: 10 });
const post = await dash.posts.get("my-first-post", { body: "blocks" });
```

## 1. スキーマ定義（TS-first、codegen レス）

Drizzle / Astro Content Collections と同じく、**TypeScript で書いたスキーマから型を推論する**。これにより旧 nhc の「真実源 3 箇所」問題（`nhc.config.ts` / 生成物 / `createCMS`）が定義 1 ファイルに畳まれる。

```ts
const posts = defineCollection({
  database: "ブログ記事DB",   // 名前指定。ID 解決は初回に行い `ndash pull` で固定化できる
  slug: "slug",               // slug にするプロパティ（必須・一意）
  properties: {
    title: p.title(),
    status: p.status(["下書き", "公開済み", "アーカイブ"]),
    tags: p.multiSelect(),
    publishedAt: p.date(),
    viewCount: p.number(),
  },
  published: { status: ["公開済み"] },
  // preview で見られる範囲（省略時: published + 下書き全部）
  accessible: { status: ["下書き", "公開済み"] },
});

// 型はすべて推論される
type Post = InferEntry<typeof posts>;
// => { slug: string; title: string; status: "下書き" | "公開済み" | "アーカイブ";
//      tags: string[]; publishedAt?: string; viewCount?: number; ... }
```

- `p.status([...])` に options を書けば `published` の値も型補完される
- **introspection は補助に降格**: `ndash pull` が実 DB からこの `defineCollection` コードの雛形を生成（Drizzle の `pull` 相当）、`ndash check` が実 DB との drift を CI で検証（Prisma の `migrate diff` 相当）
- 公開ポリシーは `defineCollection` の `published` **だけ**が住所。旧 nhc のような「CLI config に書けるが無視される」経路を作らない

## 2. エントリポイント

```ts
const dash = createDash({
  collections: { posts, pages },
  token: env.NOTION_TOKEN,
  mount: "/api/ndash",
  freshness: "fast" | "instant" | { freshFor: "1m", staleWhileRevalidate: "1h", blocking: false },
  runtime: workersRuntime({ env, ctx }),  // 省略時: 環境を自動検出
});
```

命名は `createDash` を採用する。検討した代替案:

| 案 | 評価 |
|---|---|
| `createDash`（採用） | ブランドと一致し、戻り値の慣用名 `dash` が短い |
| `ndash()` | パッケージ名と同名で import が綺麗だが、戻り値の変数名に迷う |
| `createCMS`（旧名） | 「CMS は Notion 自身」という製品定義と矛盾するため不採用 |

### グローバル操作は `$` プレフィックス

コレクションは `dash.posts` のように直下に生える。グローバル操作は名前衝突を避けるため `$` を付ける（旧 nhc は `stats` という名前の DB を作ると壊れた）:

```ts
await dash.$revalidate();                    // 全 artifact の version チェック
await dash.$revalidate({ collection: "posts", slug: "a" });
dash.$handler(request);                      // mount 配下の統合ハンドラ
dash.$scheduled();                           // cron から呼ぶ freshness ループ
```

## 3. データ取得 — 完全プレーンデータ

### get

```ts
const post = await dash.posts.get(slug);                      // メタのみ
const post = await dash.posts.get(slug, { body: "blocks" });  // + blocks（canonical）
const post = await dash.posts.get(slug, { body: "html" });    // + html（変換器で派生）
const post = await dash.posts.get(slug, { body: "markdown" });
const draft = await dash.posts.get(slug, { access: "preview" }); // 下書きも対象・別キー artifact

// 戻り値に関数は一切ない。loader からそのまま返せる
export async function loader({ params }: Route.LoaderArgs) {
  const post = await dash.posts.get(params.slug, { body: "blocks" });
  if (!post) throw new Response("Not Found", { status: 404 });
  return { post };   // ← 剥がす儀式が不要
}
```

- `body` を指定した分だけ生成・キャッシュする（旧 nhc は全モードで 4 表現を毎回生成していた）
- 内部リンクは artifact 生成時に**自動解決**済み（旧 `buildPageLinkMap` の手動呼び出しは廃止）

### list — 演算子付き where + cursor ページネーション

```ts
const page = await dash.posts.list({
  where: {
    tags: { has: "tech" },              // multiSelect → has / hasAny
    publishedAt: { lte: now },          // date / number → gt / gte / lt / lte
    title: { contains: "Notion" },      // text → contains / startsWith
  },
  sort: { publishedAt: "desc" },
  limit: 10,
  cursor: prevPage.nextCursor,
});

page.items;       // Post[]（プレーンデータ）
page.nextCursor;  // string | null
page.hasMore;     // boolean
```

- 演算子は **schema のプロパティ型から導出**される（`p.multiSelect()` のフィールドに `gt` を書くと型エラー）
- 可能な条件は **Notion API の filter / sorts へ push down** する（旧 nhc は常に全件取得 + in-memory フィルタだった）
- 旧 `tag` / `statuses` オプションは廃止し `where` に統合。`tags` というフィールド名のハードコードはしない

### params（SSG 連携）

```ts
export async function generateStaticParams() {
  return dash.posts.params();   // [{ slug: "a" }, { slug: "b" }]
}
```

## 4. レンダリング — サブパス変換器

canonical（blocks）を入力とする独立した変換器。データ層と完全に分離する。

```tsx
// React（headless: クラス名のみ。Tailwind を強制しない）
import { NotionRenderer } from "ndash/react";
<NotionRenderer blocks={post.body} components={{ Code: MyCode }} />;

// React（styled: CSS 同梱のデフォルトテーマ。1 import で見栄えが付く）
import "ndash/react/theme.css";

// HTML 文字列（Hono / Astro SSR / RSS 等）
import { renderHtml } from "ndash/html";
const html = await renderHtml(post.body, { rehypePlugins: [...] });

// Markdown
import { toMarkdown } from "ndash/markdown";
```

- React レンダラーは **headless（素のクラス名 + ComponentOverrides）と styled（CSS 同梱）の 2 層**。旧 nhc の「Tailwind v4 + shadcn テーマ必須」はやめる
- 画像はすべて `{mount}/images/{hash}` に解決済み（PortableContent の `images` を参照）

## 5. 配線 — mount 1 箇所

```ts
// 例: React Router
// app/routes.ts
route("/api/ndash/*", "routes/ndash.ts");

// routes/ndash.ts
export const loader = ({ request }) => dash.$handler(request);
export const action = ({ request }) => dash.$handler(request);
```

`mount: "/api/ndash"` の宣言 1 箇所から以下がすべて自動導出される（旧 nhc では 4 系統の手動配線だった）:

| パス | 役割 |
|---|---|
| `{mount}/images/:hash` | 画像プロキシ（Notion 署名 URL 失効対策） |
| `{mount}/webhook` | Notion webhook 受信（`freshness: "instant"`） |
| `{mount}/preview/:collection/:slug?sig=...` | 署名付きプレビュー |
| `{mount}/check/:collection/:slug` | クライアント再検証（React グルーが内部で使用。公開概念ではない） |

フレームワークアダプタ（`ndash/hono` `ndash/react-router` `ndash/next` `ndash/astro`）は、この統合ハンドラを各フレームワークの流儀でマウントする薄いグルーに徹する。

## 6. エラー体系（旧 nhc から継承）

旧 nhc の `CMSError` 設計は優れているためそのまま継承する（名称は `DashError`）:

- `code` は `<namespace>/<kind>` 形式（`source/fetch_item_failed` 等）
- `format()` が nextSteps / docsUrl 付きの整形メッセージを返す
- `isDashError()` / `err.is(code)` / `err.inNamespace(ns)` / `matchDashError()`
- 生の `Error` は throw しない

## 7. CLI（bin: `ndash`）

| コマンド | 役割 |
|---|---|
| `ndash init` | テンプレート選択 + 最小セットアップ |
| `ndash pull` | 実 DB を introspect して `defineCollection` の雛形コードを生成 |
| `ndash check` | スキーマ定義と実 DB の drift を検証（CI 用） |
| `ndash doctor` | mount 疎通・webhook 設定・token 権限・slug 重複を診断 |
| `ndash mcp` | MCP サーバー起動（コンテンツ取得 / introspection / revalidate / doctor をツール公開） |

エージェント利用を前提とする: 全コマンドに `--json`、副作用コマンドに `--dry-run`、構造化エラー（`code` 付き）と意味のある終了コード。

## 8. 旧 nhc API との対比表

| 旧 nhc | nDash | 変更理由 |
|---|---|---|
| `nhc generate`（codegen 必須） | `defineCollection` + `ndash pull/check` | 真実源を 1 ファイルに。codegen は補助に降格 |
| `createCMS({ schema, content, collections })` | `createDash({ collections, mount, freshness })` | 「CMS」名の返上。公開ポリシーは defineCollection へ |
| `content: "html" \| "react"` | `get(slug, { body })` + サブパス変換器 | 取得・表現・描画の 3 軸を 1 軸に潰していた誤りの解消 |
| `find()` → item + `html()/notionBlocks()` 遅延メソッド | `get()` → 完全プレーンデータ | シリアライズ境界の罠の根絶 |
| `list()` → `T[]`（全件 in-memory・演算子なし） | `list()` → `{ items, nextCursor, hasMore }` + 演算子 where + push down | ページネーション UI が組める・性能 |
| `SWRConfig { ttlMs }`（実態はブロッキング） | `freshness: "fast" \| "instant" \| {...}` | 語と挙動の一致。serve-stale 既定 |
| `check()` / `peekVersion()` / `NotionRevalidator poll` / `warm()` | 内部実装に隠蔽 | 鮮度概念を 1 つに |
| `imageProxyBase` + handler 手動配線（3 通り） | `mount` 1 箇所から自動導出 | 暗黙の整合契約の排除 |
| `buildPageLinkMap()` 手動呼び出し | artifact 生成時に自動解決 | 配線の宿題をなくす |
| `cms.invalidate()` / コレクションと同居 | `dash.$revalidate()` | 名前空間衝突の回避 |
| CLI config の `publishedStatuses`（dead option） | `defineCollection.published` のみ | サイレント事故の根絶 |
| `definePlugin` + CMSHooks | 当面フックのみ継承（capability 宣言は将来 ADR） | 公開面の最小化 |
