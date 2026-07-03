---
"@notion-headless-cms/react-renderer": patch
"@notion-headless-cms/cli": patch
---

v3ゼロベース再設計（#437）のコードレビューで検出した問題を修正。

- `react-renderer`: README に `./v3` サブパス（`denormalizeBlocks`/`toPageLinkMap`）の使い方セクションを追加
- `cli`: README に `nhc pull`/`nhc check`（v3 スキーマ drift 検証）のセクションを追加

`packages/v3`（非公開）側の修正（video ブロックの `sanitizeHref` 適用漏れ、`multi-source.ts` の生 `Error` throw を `CMSError` 化、`listEntries` の `limit` 負数サニタイズ、REST ストアの契約テスト追加等）は非公開パッケージのため changeset 対象外。
