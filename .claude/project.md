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

利用側の単一エントリ（v2〜・これ 1 つ + サブパスで揃う）:
  client（createCMS）/ client/cloudflare / client/next / client/react
```

すべて `@notion-headless-cms/` スコープ。`cli` は別途 introspect・型生成ツール。
v2 で旧メタパッケージ（node / cloudflare / next）は廃止し `client` に集約した。

### 核心設計原則

- **core を Notion 固有知識から隔離**: `DataSourceAdapter` インターフェースのみ定義し、実装は `notion-orm` 側に置く。将来の Contentful 等への差し替えを可能にするため
- **単一エントリ `createCMS`（v2〜）**: `@notion-headless-cms/client` の `createCMS({ schema, token, content, collections, runtime })` で `createClient` + `notionSource` + preset を 1 呼び出しに集約。`content: "html" | "react"` が取得戦略 + renderer を内部結線する。`createClient` / `notionSource` / `nodePreset` は client が re-export する escape hatch。廃止されたアダプタ（`adapter-node` / `adapter-cloudflare`）やメタパッケージ（node / cloudflare / next）は参照しない
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

main マージで `release.yml` が "Version Packages" PR を作成。その PR をマージすると npm に公開される。
