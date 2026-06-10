# nDash アーキテクチャ

## 1. 公開面: `ndash` 1 パッケージ + サブパス

旧 nhc は npm に 15 パッケージを公開し、主エントリ（client 0.2.3）と CLI（2.0.1）でバージョンが逆転し、`cloudflarePreset` が 2 箇所から同名 export される等、公開面の広さが利用者の認知コストになっていた。

nDash は React Router v7（多パッケージ → `react-router` 単一 + サブパスへ統合）と EmDash（単一リポジトリ・単一製品）の戦略を踏襲する:

```
ndash                  … エントリ（createDash / defineCollection / p / DashError）
ndash/react            … NotionRenderer（headless）+ styled テーマ CSS
ndash/html             … renderHtml
ndash/markdown         … toMarkdown
ndash/hono             … フレームワークアダプタ
ndash/react-router     … 〃
ndash/next             … 〃（draftMode 連携含む）
ndash/astro            … 〃
ndash/workers          … workersRuntime（KV/R2/cron 配線）
ndash/testing          … fakeNotion / fakeStore / fixture
ndash/cli              … bin: ndash（init / pull / check / doctor / mcp）
```

- **npm に公開するのは `ndash` のみ**。バージョンは 1 つ（fixed versioning）
- typed query 層（data 層）を単独配布する需要が見えた場合の名前は `notion-data`（npm 空き確認済み、ORM 用途での検索性重視）。**まずサブパスで開始し、需要が見えたら分離**する（→ ADR-2）

## 2. レイヤ構成

リポジトリ内部はレイヤごとのワークスペースに分けるが、**すべて private**（公開ビルド時に `ndash` へバンドル）。

```
┌─────────────────────────────────────────────────────┐
│ adapters / renderers / MCP / CLI                    │  フレームワークグルー・変換器・エージェント面
├─────────────────────────────────────────────────────┤
│ delivery                                            │  freshness ループ・artifact ストア・mount ハンドラ
│   （serve-stale / scheduled / webhook / preview）   │
├─────────────────────────────────────────────────────┤
│ content pipeline                                    │  PortableContent 生成
│   （blocks 取得・画像永続化・リンク解決・検証）     │
├─────────────────────────────────────────────────────┤
│ data                                                │  defineCollection・型推論・typed query
│   （where → Notion filter への push down）          │
└─────────────────────────────────────────────────────┘
                        ↓
                   Notion 公式 API
```

**依存方向は下向きのみ**（adapters → delivery → pipeline → data）。逆向きの import は禁止。

## 3. 設計ルール

### 3-1. コア層のゼロ依存（旧 nhc から継承）

delivery / pipeline / data の各層は `@notionhq/client` 以外の外部ランタイム依存を持たない。unified / zod / React 等は adapters・renderers 層に隔離する。レンダラーが必要な箇所は関数注入（旧 `RendererFn` パターン）で受ける。

### 3-2. ポータブルな抽象（EmDash と同原則）

EmDash は「Kysely for SQL、S3 API for storage — SQLite / D1 / Postgres / R2 / S3 / ローカルで動く。Cloudflare で最良だがロックインしない」を掲げる。nDash も同じく:

- **artifact ストアは構造型で抽象する**（旧 nhc の `R2BucketLike` / `KVNamespaceLike` パターンを継承。`@cloudflare/workers-types` への実依存なし）
- ストアは「PortableContent（JSON）と画像（バイナリ）を置ける場所」でしかない。KV / R2 / メモリ / ファイルシステム / Next.js cache はすべて同一インターフェースの実装
- **「Workers で最良、どこでも動く」**: scheduled（cron）・waitUntil・webhook が最も自然に揃うのは Workers だが、Node（interval）でも全機能が動く

### 3-3. `internal/` 非公開・公開 API は index 経由のみ

旧 nhc のルールを継承。公開面に出すものはエントリの `index.ts` で明示的に re-export する。

### 3-4. PortableContent の直列化可能性は絶対ルール

公開 API が返すデータに関数・クラスインスタンス・循環参照を含めない。`structuredClone` と `JSON.stringify` のラウンドトリップが常に成立すること（テストで保証する）。

### 3-5. 設定が黙って無視される経路を作らない

オプションは (a) 効く、(b) 型エラーになる、(c) 実行時に `DashError` で拒否される、のいずれかでなければならない。「受理されるが効かない」を禁止する（旧 nhc の `publishedStatuses` dead option・`ogp` の html モード無視の再発防止）。

## 4. ADR（アーキテクチャ決定記録）

### ADR-1: canonical 本文表現は Notion blocks ツリー 1 つ

- **決定**: PortableContent の本文は Notion 公式 `BlockObjectResponse` ツリーのみ。HTML / Markdown は変換器による派生
- **理由**: 旧 nhc は html / markdown / 独自 AST（ContentBlock）/ notionBlocks の 4 表現を全モードで毎回生成しキャッシュしていた（旧 `rendering.ts:66-197`）。表現が増えるほどキャッシュ容量・生成コスト・概念数が掛け算で増える
- **トレードオフ**: blocks は冗長で KV 容量を食う。`body: "html"` を要求された artifact には派生 HTML を併置キャッシュして再変換を避ける

### ADR-2: data 層はサブパス `ndash/data` で開始、分離は需要を見て

- **決定**: typed query 層は当面 `ndash` のサブパス。単独需要（CMS 文脈外の Notion 自動化・社内ツール）が観測できたら `notion-data` として分離公開する
- **理由**: 公開面の最小化が先。分離はいつでもできるが、統合のやり直しは破壊的変更になる

### ADR-3: フックは継承、プラグイン capability 宣言は将来構想

- **決定**: 旧 nhc の CMSHooks（afterRender / onError 等のライフサイクルフック）は最小セットで継承する。EmDash の「プラグインを Dynamic Worker サンドボックスで隔離し、manifest（OAuth スコープ類似）でアクセス先を宣言させる」方式は、サードパーティプラグイン市場を持つ段階になったら採用を検討する
- **理由**: 初期の拡張ニーズはフックで足りる。サンドボックス基盤は Workers 依存が強く、ポータブル抽象（3-2）と緊張関係があるため、設計だけ記録して実装は先送り

### ADR-4: マルチソース抽象を公開 API にしない

- **決定**: 旧 nhc の `DataSource` / `CMSSources`（module augmentation）のような「Notion 以外のソースも挿せる」公開抽象は持たない。内部のレイヤ分離（data 層の境界）としてのみ維持する
- **理由**: vision.md の Non-goal 4。公開抽象は互換性の約束であり、Notion 特化の進化（status group 推論・webhook・プロパティ書き戻し）を縛る

### ADR-5: バージョニングは fixed group・公開 1 パッケージ

- **決定**: changesets の fixed group で全ワークスペースを同一バージョンに固定し、公開は `ndash` のみ
- **理由**: 旧 nhc の「client 0.2.3 / CLI 2.0.1 / renderer 0.1.15」混在は、どれが安定 API か利用者に伝わらなかった
