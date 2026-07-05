# プロジェクト固有ガイド（notion-headless-cms）

このファイルはプロジェクト固有の詳細をまとめた単一の正。CLAUDE.md（絶対ルール・索引）から参照される。
汎用の絶対ルールは `CLAUDE.md`、パッケージ別の詳細規約は `.claude/rules/` を参照。

## 設計方針とコーディングの方向性

### パッケージ構成

```
Notion DB
  └─ notion-orm（Notion API 取得・Markdown 変換・fetchBlockTree。ユーザーは直接 import しない）
       ├─ fetch-blocks（BlockObjectResponse ツリー取得 + React Renderer）
       ├─ fetch-markdown（Notion Markdown API で本文取得）
       ├─ markdown-html（Markdown → HTML、remark/rehype ベース）
       ├─ react-renderer（BlockObjectResponse → React、shadcn/ui + Tailwind v4）
       ├─ notion-source（CMSAdapter 実装。createCMS / createClient が内部で組み込む）
       └─ core（CMS エンジン・キャッシュ・SWR・フック・nodePreset）
            └─ cache（memory + サブパス /cloudflare（R2/KV + cloudflarePreset）/next（ISR））

利用側の単一エントリ（これ 1 つ + サブパスで揃う）:
  client（createCMS）/ client/cloudflare / client/next / client/react
```

すべて `@notion-headless-cms/` スコープ。`cli` は別途 introspect・型生成ツール。

### v3（packages/cms）— もう一つの独立したパッケージファミリー

上記の `client`/`core`/`cache`/`notion-source` 系（v2）とは**別に**、`@notion-headless-cms/cms`
（v3）が Notion アクセス・同期・ストレージ・HTTP 配信を 1 パッケージに束ねた独立系として存在する。
v2 を置き換えるものではなく、要件に応じてどちらを使うか選ぶ 2 つの現行アーキテクチャ。
v2/v3 間に依存関係は無い（`packages/cms/package.json` は `core`/`cache`/`client`/`notion-source`
のいずれにも依存しない）。実運用での消費例: `euphoric-band-site`（Cloudflare Workers + Durable
Objects で完全マテリアライズド配信）。

- **`createCMS`（v3）が作るもの**: KV/R2 上に構築されるマテリアライズドなコンテンツレプリカ。
  読み取り（`find`/`list`）は KV/R2 の参照だけで完結し、**リクエスト処理中に Notion API を一切呼ばない**。
  Notion との同期はリクエスト経路から切り離され、`notion`（トークン/クライアント）+ `scheduler` を
  渡してこのインスタンス自身に同期させるか、`syncDelegate` で外部（Durable Object 等）に丸ごと委譲する
- **サブパスエクスポート**:
  - `.`（本体）— `createCMS` / `defineCollection` / `defineSchema` / `prop` などランタイム非依存の中核
  - `./html` — React を使わない利用者向けの HTML レンダラ（`renderBlocksToHtml` 等）
  - `./cloudflare` — Cloudflare 固有実装（KV/R2 ストア、Durable Object 由来の sync delegate・DO クラスファクトリ、WebSocket realtime hub）。詳細: `.claude/rules/cloudflare.md`
  - `./node` — Node 専用ストア（`node:fs` に依存するため本体から分離）
  - `./testing` — vitest 前提のストア契約テストユーティリティ（本体に vitest をバンドルしないため分離）
- **核心設計アイデア**:
  - `defineCollection`/`defineSchema` による TypeScript ファーストのスキーマ定義（codegen ではなく直接 TS で書き、育てる運用）
  - 公開ポリシーは `published`/`accessible`（`statusProperty` の値集合）で表現する。`published` は一覧（`list`）に載せるかどうか、`accessible` は個別取得（`find`）を許すかどうかで、両者は独立に指定できる（`accessible` 省略時は `published` にフォールバック）
  - 画像・内部リンク・プロパティの変換は**同期時**に行い、読み取り時は素の JSON を返すだけにする（読み取り経路を外部呼び出しゼロに保つため）

詳細な API 面・モジュール構成は `.claude/rules/cms.md`、設計の「なぜ」は `docs/ja/architecture.md`
の「packages/cms（v3）」節を参照。

### 核心設計原則

- **core を Notion 固有知識から隔離**: `DataSourceAdapter` インターフェースのみ定義し、実装は `notion-orm` 側に置く。将来の Contentful 等への差し替えを可能にするため
- **単一エントリ `createCMS`**: `@notion-headless-cms/client` の `createCMS({ schema, token, content, collections, runtime })` で `createClient` + `notionSource` + preset を 1 呼び出しに集約。`content: "html" | "react"` が取得戦略 + renderer を内部結線する。`createClient` / `notionSource` / `nodePreset` は client が re-export する escape hatch
- **拡張可能な sources（module augmentation）**: core は空の `CMSSources` インターフェースを公開し、`@notion-headless-cms/notion-source` などのアダプターパッケージが `declare module "@notion-headless-cms/core" { interface CMSSources { notion?: CMSAdapter } }` で宣言マージしてキーを追加する（Fastify プラグインと同じパターン）。CLI は DB 構造（`schema`）のみを生成し、token / 公開ポリシー等の振る舞いは `createCMS` 側で組み立てる
- **構造型による抽象化**: `R2BucketLike` など、型だけ定義してランタイムパッケージへの直接依存を排除（テスト容易性向上）
- **`internal/` は非公開**: `packages/*/src/internal/**` を他パッケージから import 禁止。公開したければ `src/index.ts` で re-export する（詳細: `.claude/rules/package-boundaries.md`）

### コードスタイル要点

- **Biome**: インデントはスペース 2 幅、クォートはダブル (`"`)。`pnpm format` で自動修正
- **型インポート**: `import type { ... }` を必ず使う（`verbatimModuleSyntax: true`）
- **モジュール**: ES Modules のみ。`require()` / CommonJS は禁止
- **コメント**: 日本語・WHY のみ。コードで自明なことは書かない（詳細: `.claude/rules/coding-style.md`）

### エラー処理

すべて `CMSError` に統一。生の `Error` は throw しない。コードは `<namespace>/<kind>` の二段形式（例: `source/fetch_items_failed`, `cache/io_failed`）。詳細は `.claude/rules/error-handling.md`。

### SWR とキャッシュの注意点

- TTL 切れはブロッキングフェッチ（キャッシュが stale でも返さない—ユーザー要件）
- Notion 画像 URL は約 1 時間で失効 → `fetchAndCacheImage` で SHA256 ハッシュキーに永続化し、プロキシ経由で配信する
- `peerDependencies` は利用側でインストール。パッケージ間依存は `workspace:*`

### テスト

vitest、coverage 閾値 70%。モックパターン（DataSource / renderer / R2 / fetch / fakeTimers）は `.claude/rules/testing.md` を参照。

## 詳細ドキュメントの場所

- 全体構成・セットアップ: `README.md`
- ワークスペース構成: `pnpm-workspace.yaml`
- パッケージ固有ルール: `.claude/rules/<area>.md`（`paths:` 指定で該当パス編集時のみ自動注入）
- 手順・ワークフロー: `.claude/skills/<name>/SKILL.md`（`/<name>` で明示呼び出し）
- 設計背景: `docs/ja/architecture.md`

## 共通コマンド

- `pnpm build` / `pnpm typecheck` / `pnpm test` / `pnpm format` / `pnpm lint`
- `pnpm changeset` — changeset 作成（`/changeset-flow` で補助）
- 個別: `pnpm --filter @notion-headless-cms/<pkg> <script>`

## `.claude/` 編集フロー

```bash
# 1. 作業フォルダを用意（最初だけ）
cp -r .claude .claude-next

# 2. .claude-next/ 配下で編集
$EDITOR .claude-next/rules/xxx.md

# 3. diff を確認
diff -r .claude .claude-next

# 4. 問題なければ一括コピー
rsync -a --delete .claude-next/ .claude/
# または: rm -rf .claude && cp -r .claude-next .claude
```

- `.claude-next/` は `.gitignore` に追加しておくか、コピー後に削除する
- 本セッションからは **`.claude/` への直接書き込みを避ける**

## リリース

二段構え。日常の main 追従は canary が自動、正式な latest は手動トリガーのみ。

- **canary（自動、routine）**: main への push（feature PR のマージ）のたびに `release.yml` が pending changeset の内容から snapshot バージョン `0.0.0-canary-<sha>` を組み立て、`canary` タグで npm publish する。Version Packages PR は作らず、changeset ファイルも消費しない（次の正式リリース判断のために main 上に残り続ける）。
- **stable（手動、正式リリース）**: `release-stable.yml` を workflow_dispatch で起動すると、pending changeset があれば "Version Packages" PR を作成する。その PR をマージすると（コミットメッセージが `Version Packages` で始まる push を検知して）同ワークフローが再度走り、`latest` タグで npm publish する。
- 両ワークフローは `concurrency.group: npm-publish` を共有し直列化される（Version PR マージ時に canary の no-op publish と stable の publish が競合しないようにするため）。
- band site 側は `@notion-headless-cms/cms@canary` のように canary タグを exact pin して main の変更を追従できる（`^3.x` のような semver range は `0.0.0-canary-*` にはマッチしないため、stable 利用者が誤って canary を掴むことはない）。

### ローカルから手動公開する（緊急フォールバック）

新規 scope パッケージの初回公開など、CI の npm トークンに作成権限がまだ無く CI 公開が 404 で落ちる場合のフォールバック。各公開パッケージに `release:local`（= `pnpm publish --no-provenance --no-git-checks`）を用意してある。

```bash
# 公開したいパッケージ dir 内で「直接」実行する
pnpm --filter <パッケージ名> run release:local
# 例: pnpm --filter @notion-headless-cms/client run release:local
```

- **`pnpm -r publish` / `pnpm --filter ... publish` で publish 自体を回さないこと**。再帰・フィルタ publish では `--no-provenance` が下層へ転送されず、`publishConfig.provenance: true` が優先されて `provider: null`（provenance はローカルでは生成不可）で失敗する（pnpm 既知挙動: pnpm/pnpm#6607・#11728）。**各パッケージ dir 内で直接 `pnpm publish` する形（= `release:local` を `--filter ... run` で呼ぶ）なら `--no-provenance` が効く**。
- 2FA OTP を求められたら認証アプリのコードを入力する（ブラウザ認証フローが開くこともある）。
- provenance 無しで公開されるのはこの版のみ。次バージョン以降は CI が `NPM_CONFIG_PROVENANCE=true` + OIDC で provenance 付き公開に戻す。
