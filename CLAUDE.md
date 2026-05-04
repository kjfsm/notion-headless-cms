# CLAUDE.md

Notion をヘッドレス CMS として利用する TypeScript ライブラリ群のモノレポ。
npm スコープ `@notion-headless-cms/*` で公開。

## 絶対ルール

1. **言語**: コメント・コミットメッセージ・PR 概要はすべて**日本語**
2. **変更後**: 必ず `pnpm typecheck && pnpm test`。失敗を残したままコミットしない
3. **core はゼロ依存**: `packages/core` は `@notionhq/client` / `unified` / `zod` / `@notion-headless-cms/renderer` に静的 import で依存しない（詳細: `.claude/rules/core.md`）
4. **シークレット**: コードにハードコードしない。環境変数 / `wrangler secret` / `env()` ヘルパー経由（詳細: `.claude/rules/secrets.md`）
5. **`.claude/` の編集は `.claude-next/` で作業してから一括コピー**する（本セッション中の反映事故を避け、差分レビューしやすくするため）
6. **changeset の bump 種別**: 明示的な指示がない限り **`patch`** を使う（`major` / `minor` は指示があった場合のみ）

## 設計方針とコーディングの方向性

### パッケージ構成

```
Notion DB
  └─ notion-orm（Notion API 取得・Markdown 変換・fetchBlockTree。ユーザーは直接 import しない）
       ├─ renderer（Markdown → HTML、remark/rehype ベース）
       ├─ react-renderer（BlockObjectResponse → React、shadcn/ui + Tailwind v4）
       └─ core（CMS エンジン・キャッシュ・SWR・フック・nodePreset）
            ├─ cache-r2（Cloudflare R2 + cloudflarePreset）
            ├─ cache-kv（Cloudflare KV）
            ├─ cache-next（Next.js ISR）
            └─ adapter-next（Next.js App Router グルー）
```

すべて `@notion-headless-cms/` スコープ。`cli` は別途 introspect・型生成ツール。

### 核心設計原則

- **core を Notion 固有知識から隔離**: `DataSourceAdapter` インターフェースのみ定義し、実装は `notion-orm` 側に置く。将来の Contentful 等への差し替えを可能にするため
- **preset パターン（v0.3.0〜）**: `nodePreset()` (core) / `cloudflarePreset({ env })` (cache-r2) で `createCMS` 一本に統一。廃止されたアダプタ（`adapter-node` / `adapter-cloudflare`）は参照しない
- **構造型による抽象化**: `R2BucketLike` など、型だけ定義してランタイムパッケージへの直接依存を排除（テスト容易性向上）
- **`internal/` は非公開**: `packages/*/src/internal/**` を他パッケージから import 禁止。公開したければ `src/index.ts` で re-export する

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
- 設計背景: `docs/architecture.md`
- マイグレーション: `docs/migration/README.md`

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

## 自己更新ルール

同じ指摘を 2 回以上受けた事項は以下の優先順位でドキュメントに追記する:

1. **パス固有の事実** → `.claude/rules/<area>.md`
2. **手順・テンプレ・ワークフロー** → `.claude/skills/<name>/SKILL.md`
3. **全セッションで必要な絶対ルール** → この `CLAUDE.md`
