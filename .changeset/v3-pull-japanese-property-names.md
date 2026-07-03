---
"@notion-headless-cms/cli": patch
---

`nhc pull`/`nhc check`（v3）で日本語などの非 ASCII のみのプロパティ名が識別子生成時に
すべて `unnamed` へ潰れて衝突していたバグを修正した。

- プロパティ種別ベースの識別子（`unnamedTitle`/`unnamedStatus` 等）+ 連番へフォールバックし、
  同名衝突を避けるようにした（`packages/cli/src/v3/identifier.ts` に新設）
- `nhc pull` が生成するコードには、フォールバックした場合のみ元のプロパティ名を
  JSDoc コメントとして残すようにした
- `nhc pull`/`nhc check` で重複していた識別子変換ロジックを共通化した
