---
title: "RFC: v2 使い勝手のコンセプト再設計"
description: クリーンスレート v2 で組み立て儀式の摩擦をなくすための設計提案
category: ガイド
order: 3
---

# RFC: v2 使い勝手のコンセプト再設計

> ステータス: **提案（Draft）** / 対象: クリーンスレート v2（破壊的変更を許容）
> この文書は「どう作るのがベストか」をコンセプトレベルで提案するものであり、
> まだ実装は伴わない。レビュー後に実装可否・優先度を判断する。

## 1. 背景と問題提起

本ライブラリは機能面では成熟している（SWR キャッシュ・画像プロキシ・Webhook 受信・
マルチランタイム対応）。一方で、**利用者が最初の CMS インスタンスを組み立てるまでの
「組み立て儀式」に摩擦が集中**している。現状コードから確認できた摩擦点は次の 4 つ。

### 1.1 情報の住所がバラバラ（二重定義）

`nhc.config.ts` に書いた設定の一部が生成物に反映されず、実行時に再記述させられる。

```ts
// nhc.config.ts — ここに publishedStatuses も書ける
export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  collections: {
    posts: { dbName: "ブログ記事DB", slugField: "slug", statusField: "status" },
  },
});
```

ところが `nhc generate` が出力する `schema` は `dataSourceId` / `properties` /
`slugField` / `statusField` の 4 つしか持たない。結果、実行時にもう一度書く:

```ts
// 実行時 — token と publishOptions を“再記述”させられる
const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN!,                       // config にも書いた
      publishOptions: { posts: { publishedStatuses: ["公開済み"] } }, // config にも書ける
    }),
  },
  ...nodePreset(),
});
```

逆に `slugField` / `statusField` は config（と生成物 schema）にしか住所が無い。
**「どの情報がどこに住んでいるか」が直感的でない**のが根本問題。

### 1.2 3 ファクトリの spread 合成が不透明

入口が `createClient` + `notionSource` + `preset` の 3 つの合成になっている。

```ts
const cms = createClient({
  sources: { notion: notionSource({ /* ... */ }) },
  renderer: notionMarkdownRenderer,
  ...cloudflarePreset({ env, ctx }),   // spread で cache/swr/waitUntil が暗黙にマージ
});
```

`...preset()` の spread は何がマージされるかが読み手に見えない。さらに cache の配線が
ランタイムで不統一: Node/Cloudflare は preset 経由だが、Next.js の例は preset を使わず
`cache: [nextCache(), memoryCache()]` を直書きしている。

### 1.3 fetch 戦略と renderer の結合フットガン

本文の取得戦略（`blocksFetcher()` / `markdownFetcher()`）と renderer が**別々のフィールド**
で、しかも整合させないと壊れる。

```ts
notion: notionSource({ schema, token, fetch: markdownFetcher() }),
renderer: notionMarkdownRenderer,   // markdownFetcher を選んだら、これも必須
```

`markdownFetcher()` を選ぶと `notionBlocks()` が `undefined` を返す
（型は `Promise<unknown[] | undefined>`、`collection.ts` が一度だけ警告ログを出す）。
**2 つの独立した決定を正しく噛み合わせないと実行時に黙って壊れる**。

### 1.4 決定の多さ

利用開始までに利用者が下す決定が多い:

- メタパッケージ 3 つから 1 つ選ぶ（`node` / `cloudflare` / `next`）。
- peer deps を手で入れる（`@notionhq/client zod notion-to-md`）。
- fetch 戦略を選ぶ（blocks か markdown か）。
- 対応する renderer を選ぶ。

---

## 2. 設計原則（v2 の北極星）

### 原則 1: 単一の真実源

各情報の住所を 1 つにする。同じ値を 2 箇所に書かせない。

### 原則 2: 責務分割の判定ルール（明文化）

> **`nhc generate` 時に Notion API アクセスが必要な情報は「構造」（config → 生成物 schema）。
> それ以外は「振る舞い」（`createCMS` の引数）。**

この一文で、将来オプションを追加したときも住所が自動的に決まる。曖昧になりがちな項目
（`imageProxyBase` は振る舞い、`fieldMappings` は構造）もこのルールで一意に裁ける。

### 原則 3: 2 つの時間軸を混ぜない

- **構築時**（`createCMS`）: 環境配線。アプリ起動時に 1 回。
- **リクエスト時**（フレームワークグルー: `createNextHandler` 等）: ルーティング。

両者を 1 つの API に押し込まない。グルーは構築済みの CMS インスタンスを後から受け取る。

---

## 3. 責務分割の確定表

| 情報 | 住所 | 理由 |
|---|---|---|
| `dataSourceId` / `dbName` | **構造**（config→schema） | generate 時に Notion API で解決 |
| `properties` + 型 | **構造** | generate 時に introspect |
| `fieldMappings` | **構造** | codegen が TS フィールド名生成に使う |
| `slugField` / `statusField` | **構造** | アイテム**型の導出入力**（config 以外に住所を持てない） |
| status の options（許容値） | **構造（新規追加）** | generate 時に確定。`published`/`accessible` の型安全化に使う |
| `notionToken`（generate 用） | **構造側 config に残す** | generate 時の introspect に必要 |
| `token`（実行時） | **振る舞い**（createCMS） | ランタイムの env に依存 |
| `published` / `accessible` | **振る舞い** | 公開ポリシー。config から**削除**して住所を 1 つに |
| `content` モード | **振る舞い** | 取得・表現方法。DB 構造と直交（同一 schema を html/react で共用可） |
| `imageProxyBase` | **振る舞い** | 配信パスの方針 |
| `hooks` / `plugins` / `logger` / `rateLimiter` / `swr` | **振る舞い** | すべて実行時の関心事 |
| `webhookSecret` | **グルー（handler）の引数** | リクエスト処理時の関心事。createCMS には入れない |

> **注**: status options を schema に含めると、Notion 側で選択肢が変わるたび `nhc generate`
> が必要になる（型と実体の drift）。これは properties 生成と同じ性質で許容範囲。
> 「`published` に渡す値は generate 時点の選択肢」という前提を docs に明記する。

---

## 4. 単一エントリ `createCMS`

3 ファクトリの合成を 1 つの `createCMS` に集約する。

### Before → After

```ts
// ── Before（現行）──
const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN!,
      fetch: markdownFetcher(),
      publishOptions: { posts: { publishedStatuses: ["公開済み"] } },
    }),
  },
  renderer: notionMarkdownRenderer,
  ...cloudflarePreset({ env, ctx }),
});
```

```ts
// ── After（v2）── Node（既定ランタイム）
import { schema } from "./generated/nhc";
import { createCMS } from "@notion-headless-cms";

export const cms = createCMS({
  schema,                                       // 構造（生成物）
  token: process.env.NOTION_TOKEN!,             // 振る舞い
  content: "html",                              // 単一決定で fetch戦略+renderer を内部結線
  collections: { posts: { published: ["公開済み"] } },
});
```

```ts
// ── After（v2）── Cloudflare（env/ctx はリクエスト毎なので factory）
import { createCMS, cloudflare } from "@notion-headless-cms";

export const makeCms = (env: Env, ctx: ExecutionContext) =>
  createCMS({
    schema,
    token: env.NOTION_TOKEN,
    content: "react",
    runtime: cloudflare({ env, ctx }),          // preset の spread と cache配列を統一
    collections: { posts: { published: ["公開済み"] } },
  });
```

利点:

- `notionSource` / `preset` の中間ファクトリが消え、入口が 1 つになる。
- token / published が config と二重定義にならない（住所が createCMS だけ）。
- spread が消え、すべてが名前付きフィールドになる。

---

## 5. `runtime` フィールドへの統一

`...preset()` の spread と `cache` 配列を、単一の `runtime` フィールドに統一する。

| 現行 | v2 `runtime` |
|---|---|
| `nodePreset()` → `{cache:[memoryCache], swr}` | `runtime` 省略 = node 既定（内部で memoryCache 配線） |
| `cloudflarePreset({env,ctx})` → `{cache:[kv,r2], swr, waitUntil}` | `runtime: cloudflare({ env, ctx })` |
| Next 直書き `cache:[nextCache(), memoryCache()]` | `runtime: next()` |

設計上の決定:

- `cloudflare(...)` / `next()` は**ファクトリ関数**にする。`waitUntil` は `ctx.waitUntil` の
  再ラップなので、`cloudflare({ env, ctx })` が内部で生成して隠蔽する。
- `ctx` の必須性を**型で強制**する（省略すると SWR のバックグラウンド更新が打ち切られるため）。
  テスト用に `cloudflare.forTest({ env })` を残す。
- `prefix`（KV/R2 キープレフィックス）等の細かい調整は runtime ファクトリの第 2 引数に逃がす。
- **フレームワークグルーは runtime に押し込まない**。`createNextHandler(cms, opts)` /
  `createNextWebhookHandler(cms, opts)` は従来通り**構築済み CMS を後から受け取る**形を維持する
  （構築時に存在しない req/params をルーティング時に扱うため。原則 3）。

---

## 6. `content` モードと型分岐（フットガン排除）

取得戦略と renderer という**2 つの独立した決定を、1 つの `content` 決定に束ねる**。

### 短縮形と escape hatch（判別共用体）

```ts
type ContentMode = "html" | "react";
// content は string | ContentConfig のユニオン。90% は短縮形で済む。

content: "html"    // 糖衣: markdown 取得 + markdown→HTML renderer
content: "react"   // 糖衣: blocks 取得 + react-renderer

// 拡張が要る人だけオブジェクト形式（escape hatch を最初から型に入れる）
content: { mode: "html",  remarkPlugins: [shiki(), katex()], renderer: myRenderer }
content: { mode: "react", blocks: { myBlock }, ogp: { /* ... */ } }
```

**mode ごとに escape hatch の型を変える**（html は `remarkPlugins` / `renderer`、
react は `blocks` / `ogp`）。これにより「react モードなのに markdown renderer を渡す」といった
不整合を型レベルで排除する。OGP / shiki / katex / カスタムブロック / カスタム renderer の
拡張性は escape hatch 側に温存され、失われない。

### アイテム本文アクセサを content に応じて分岐

```ts
// content:"html"
type HtmlItem<T>  = T & { html(): Promise<string>; markdown(): Promise<string> };
// content:"react"
type ReactItem<T> = T & { blocks(): Promise<NotionBlock[]> };   // undefined にならない
```

- `content:"html"` のとき `.notionBlocks()` は**型に存在しない**（呼べない）。
- `content:"react"` のとき `.blocks()` は `NotionBlock[]` 固定（`undefined` フットガン解消）。

### 実装方式: クラス全体ジェネリック `M`

条件型のネストを深くするより、`content` の型 `M` を `createCMS` 全体のジェネリックに引き上げ、
`find()` / `list()` の戻り値型まで伝播させる方が推論が安定する。

```ts
function createCMS<S extends Schema, M extends ContentMode = "html">(
  opts: { schema: S; content?: M; /* ... */ },
): CMSClient<S, M>;
```

IDE 表示改善のため、アクセサ型に `HtmlItem` / `ReactItem` の別名 interface を与える。

> **受け入れ基準**: 二重ジェネリック（`M` × 既存のプロパティ型導出 `CMSItemFromSchema`）の
> 推論負荷リスクがあるため、**型チェック時間のベンチ**を実装時の受け入れ基準に含める。

---

## 7. パッケージ集約とゼロ依存 core の再定義

### 公開面の集約

公開 npm パッケージをサブパス構成に集約する:

```
@notion-headless-cms          .       → createCMS / runtimes（cloudflare/next）/ content
                              ./react → Renderer + revalidator（React 利用者のみ）
                              ./cli   → nhc
```

`notion-orm` / `markdown-html` / `fetch-blocks` / `fetch-markdown` / `cache` は
**モノレポ内部の別ビルド単位（別 entry）として維持**し、公開面だけバレル re-export で束ねる
（`exports` サブパス + `sideEffects:false` で tree-shaking を確保）。

### ゼロ依存 core の再定義

現行ルールの本質は「**core のバンドルに `@notionhq/client` / `unified` / `zod` を含めない**」
ことであり、パッケージが分かれていること自体が目的ではない。そこで:

> ゼロ依存 core を「公開パッケージ単位」ではなく
> **「core ビルドターゲットの静的 import ゼロ + renderer 注入可能性」**と再定義する。

内部の `packages/core/src/` ディレクトリを維持すれば、PreToolUse hook
（`block-core-forbidden-imports.sh`）の検査もそのまま生き続ける。

### 2 つの境界を守る

- **react は必ず `@notion-headless-cms/react` サブパスに閉じ、ルートから re-export しない**
  （html ユーザーのクライアントバンドルへの shadcn/react 混入を防ぐ）。
- **`DataSource` / `CMSAdapter` の source 抽象は温存**する。`createCMS({ schema, token })` は
  「既定で notion source を組む糖衣」と位置づけ、上級者向けに
  `createCMS({ source: contentfulSource(...) })` の escape hatch を残す
  （Contentful 等への差し替え将来像を壊さない）。

---

## 8. 依存関係（peer → 通常依存）のポリシー

`pnpm add @notion-headless-cms` 1 つで動くことを目標にする。

| 依存 | v2 方針 | 理由 / 注意 |
|---|---|---|
| `@notionhq/client` | **`dependencies` に畳む** | API 呼び出しの中核。range は `^5` 等緩めにし、メジャー追従ポリシーを明記 |
| `zod` | dependencies に畳む | 利用側が直接使わないなら重複も実害小 |
| `notion-to-md` | **動的 import / optional 維持を検討** | markdown 戦略専用。react ユーザーには不要 |

> Notion API は v5 で `data_sources` 概念が入ったように破壊的変更がある。dependencies に固定すると
> ユーザーが先行更新できないため、version range の広さと追従ポリシーを RFC 実装時に明記する。
> size-limit の閾値も集約後に再設定が必要。

---

## 9. CLI と生成物（単一真実源の徹底）

- `generated/nhc.ts` は **schema データのみ**を生成する。**配線済みの createCMS ラッパーは生成しない**
  — 振る舞い（token / published / content / runtime）を generate 時に焼き込むと、
  リクエスト時の env に依存する値をビルド時に確定させることになり、1.1 の二重定義問題を裏返しで
  再発させるため。
- ただし `CollectionSchemaEntry` に**status options を追加**し、createCMS の `published` /
  `accessible` を schema から型付けできるようにする。
- `nhc init` は**雛形 `src/lib/cms.ts` を一度だけ生成**（既存があれば上書きしない）。配線例は
  「生成物」ではなく「テンプレート」として置き、振る舞いの所有権はユーザーに残す。

これにより「init 直後は完成形が置かれている（最短）」と「振る舞いは createCMS でユーザーが持つ
（単一の真実源）」を両立する。

---

## 10. 移行の方向性（概略）

| 現行 | v2 |
|---|---|
| `createClient({ sources: { notion: notionSource({ schema, token, fetch, publishOptions }) }, renderer, ...preset() })` | `createCMS({ schema, token, content, runtime, collections })` |
| `notionSource({ publishOptions: { posts: { publishedStatuses } } })` | `createCMS({ collections: { posts: { published } } })` |
| `fetch: markdownFetcher()` + `renderer: notionMarkdownRenderer` | `content: "html"` |
| `fetch: blocksFetcher()`（暗黙） + react-renderer | `content: "react"` |
| `...nodePreset()` | `runtime` 省略（node 既定） |
| `...cloudflarePreset({ env, ctx })` | `runtime: cloudflare({ env, ctx })` |
| Next 直書き `cache:[nextCache(), memoryCache()]` | `runtime: next()` |
| `@notion-headless-cms/{node,cloudflare,next}` | `@notion-headless-cms`（単一） |

詳細な移行手順（コードモッド含む）は別途 `docs/ja/migration/` に切り出す。

---

## 11. 未解決の論点 / 受け入れ基準

1. **型チェック時間のベンチ**を受け入れ基準に含める（二重ジェネリック `M` ×
   `CMSItemFromSchema` の推論負荷）。多コレクション × 多プロパティの schema で tsserver が
   重くならないことを確認する。
2. `notion-to-md` を dependencies に畳むか動的 import に残すかの最終判断。
3. `imageProxyBase` の単一ソース化（createCMS に置き、グルーの `imagesPath` がそこから読む形）。
4. status options を schema に含めることによる generate 頻度の増加が許容範囲か。

---

## 付録: この RFC が満たす目標との対応

| ユーザーが定めた方針 | 本 RFC の対応箇所 |
|---|---|
| 単一の真実源（config 一元化） | §2 原則 1・2 / §3 確定表 / §9 |
| DB 構造は config、それ以外は createCMS | §2 原則 2 / §3 確定表 |
| パッケージ・選択肢の削減 | §4 単一 createCMS / §5 runtime 統一 / §7 集約 / §8 単一インストール |
| 型安全・フットガン排除 | §6 content モードと型分岐 / §3 status options 型付け |
| クリーンスレート v2（破壊的 OK） | §10 移行の方向性 |
