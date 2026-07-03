---
"@notion-headless-cms/react-renderer": patch
"@notion-headless-cms/cli": patch
---

v3 ゼロベース再設計（#437）の基盤を `packages/v3`（非公開ステージングパッケージ）に追加し、既存パッケージに橋渡しを追加した。

- `react-renderer`: `./v3` サブパスを追加。`denormalizeBlocks` が v3 の正規化 block（`NormalizedBlock`）を既存の `BlockObjectResponse` 形状へ復元するため、既存のブロックコンポーネント約30種を無改修のまま再利用できる。`toPageLinkMap` で `EntrySnapshot.links` を既存の `pageLinks` プロップ形式に変換する。`Image` コンポーネントは任意の `_dimensions`（v3 パイプラインが焼き込む width/height）があれば付与する CLS 対応を追加（無ければ従来どおり）
- `cli`: `packages/cli/src/v3/` に pull（スキーマ雛形生成）・check（drift 検証）・doctor（診断）・sync（手動 kick）・init（wrangler 設定雛形）のロジックを追加。既存の `generate`/`init` コマンドとは独立

`packages/v3` 自体は非公開（`private: true`）のステージングパッケージで、公開パッケージへの統合は別途行う。
