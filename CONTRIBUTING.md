# コントリビューションガイド

このリポジトリへの貢献を歓迎します。参加にあたっては [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) を守ってください。
脆弱性を発見した場合は、公開 issue ではなく [SECURITY.md](SECURITY.md) の手順で報告してください。

## 環境セットアップ

### 必要なツール

| ツール  | バージョン                                          |
| ------- | --------------------------------------------------- |
| Node.js | `>=24`                                              |
| pnpm    | `10.x`（`package.json` の `packageManager` に固定） |

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
pnpm --filter @notion-headless-cms/cms test
pnpm --filter @notion-headless-cms/cms build
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

- **`@notion-headless-cms/cms` はゼロ依存**: 他 workspace パッケージへの `dependencies` を持たない独立パッケージ（`peerDependencies` は `@notionhq/client` / `katex` / `shiki` / `vitest` のみ）
- **`internal/` は非公開**: `packages/*/src/internal/**` を他パッケージから import しない
- 詳細: `.claude/rules/package-boundaries.md`

## ディレクトリ構成

```
packages/
  cli/            — nhc コマンド（nhc init / pull / check / doctor / sync）
  cms/            — Notion アクセス・同期・ストレージ・HTTP 配信を統合する唯一の現行アーキテクチャ（読者リクエスト中に Notion API を呼ばない）
  react-renderer/ — 正規化ブロック（NormalizedBlock[]）→ React コンポーネント
examples/         — 各ランタイム向けサンプル
docs/             — ドキュメント
```

詳細は [docs/ja/development.md](docs/ja/development.md) を参照してください。
