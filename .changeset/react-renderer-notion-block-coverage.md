---
"@notion-headless-cms/react-renderer": major
---

react-renderer の Notion ブロック対応を大幅に拡充（破壊的変更を含む）。

主な変更:

- **block-level color を全ブロックに反映**: paragraph / heading_1..4 / quote / callout / toggle / to_do / list_item の `color` / `*_background` が Tailwind class に変換される（`lib/notion-color.ts`）。
- **inline equation** をデフォルトで KaTeX レンダ。`katex` を peer に入れているだけで動作（クライアントで動的 import、未インストール時はテキストフォールバック）。
- **mermaid コード**: `code` ブロックの `language === "mermaid"` を既定で SVG に描画（クライアントで動的 import）。`mermaid` を optional peer に追加。
- **TableOfContents**: ページ内 `heading_1..4` を `NotionRenderer` 側で自動抽出し、`<nav>` リンクツリーとして描画。`Heading` には `id={block.id}` を必ず付与。
- **numbered list の入れ子**: `<ol>` の list-style を深さに応じて `decimal → lower-alpha → lower-roman` でローテーション。
- **LinkToPage**: `NotionRendererProps.resolvePageTitle` で本文タイトルを差し替え可能に。アイコンを `FileText` に変更し、ラベルは `resolvePageTitle?.(id) ?? "Open page"`。
- `ComponentOverrides.InlineEquation` slot を追加。
- 軽微: `callout` 空時の潰れ防止 / `code` 言語ラベル `plain text` → `text` 正規化 / `table` を `w-full` 明示 / `divider` の `bg-border h-px` 明示。

破壊的変更:

- サブパス `@notion-headless-cms/react-renderer/equation` を**廃止**。`Equation` は既定で動的 KaTeX 対応。
- サブパス `@notion-headless-cms/react-renderer/code` を**廃止**。`Code` は既定で mermaid 対応。Shiki シンタックスハイライトは引き続き `notion-shiki` enricher の `__cachedHtml` で server-side pre-render。
- `Heading` の DOM に `id` 属性が必ず出力される。
- `Callout` は `Card` → `Alert + AlertDescription` 構造に変更済（PR #289）の上で `bg-muted/40` フォールバックを上乗せ。
- 各 block の出力 DOM/class が color 反映により変化。
