# コントリビューションガイド

このリポジトリへの貢献を歓迎します。

## 環境セットアップ

### 必要なツール

| ツール | バージョン |
|---|---|
| Node.js | `>=22` |
| pnpm | `10.x`（`package.json` の `packageManager` に固定） |

### 初回セットアップ

```bash
git clone https://github.com/kjfsm/notion-headless-cms.git
cd notion-headless-cms
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

## 開発コマンド

```bash
pnpm build        # 全パッケージをビルド
pnpm typecheck    # TypeScript 型チェック
pnpm test         # テスト実行
pnpm lint         # Biome による lint + format チェック
pnpm format       # Biome による自動フォーマット
pnpm knip         # 未使用コード・依存の検出
```

特定パッケージのみ実行する場合:

```bash
pnpm --filter @notion-headless-cms/core test
pnpm --filter @notion-headless-cms/renderer build
```

## PR を送る前に

1. `pnpm typecheck && pnpm test` が通ること
2. `pnpm lint` でエラーがないこと（`pnpm format` で自動修正可）
3. 変更内容に応じて changeset を作成すること:

```bash
pnpm changeset
```

bump 種別は原則 **patch**。API の追加は `minor`、破壊的変更は `major`（相談してください）。

## コーディング規約

- **コメント・コミットメッセージ**: 日本語
- **インポート**: `import type { ... }` を使う（`verbatimModuleSyntax: true`）
- **エラー処理**: `throw new CMSError(...)` を使い、素の `Error` は throw しない
- **コメント**: WHY が非自明な場合のみ。コードで自明なことは書かない

## パッケージ境界ルール

- **`@notion-headless-cms/core` はゼロ依存**: `@notionhq/client` / `unified` / `zod` / `@notion-headless-cms/renderer` を静的 import しない
- **`internal/` は非公開**: `packages/*/src/internal/**` を他パッケージから import しない
- 詳細: `.claude/rules/package-boundaries.md`

## ディレクトリ構成

```
packages/
  core/        — CMS コアエンジン（SWR・キャッシュ・フック）
  renderer/    — Markdown → HTML 変換
  notion-orm/  — Notion API レイヤー（DataSource 実装）
  cli/         — nhc コマンド（スキーマ自動生成）
  adapter-next/ — Next.js App Router グルー
  cache-r2/    — Cloudflare R2 + KV キャッシュアダプタ
  cache-kv/    — Cloudflare KV キャッシュアダプタ
  cache-next/  — Next.js ISR キャッシュアダプタ
examples/      — 各ランタイム向けサンプル
docs/          — ドキュメント
```

詳細は [docs/development.md](docs/development.md) を参照してください。
