---
"@notion-headless-cms/notion-orm": patch
---

`@notion-headless-cms/notion-orm` を npm 公開対象に変更。

これまで `private: true` のため npm には公開されておらず、CLI が生成する
`nhc-schema.ts` が `@notion-headless-cms/notion-orm` を import しているにも
関わらず、別リポジトリからは `pnpm add @notion-headless-cms/notion-orm` で
解決できない状態だった。README / docs / `docs/migration/v1-orm-split.md` で
インストールを案内している以上、npm に公開されているのが本来の意図である。

- `package.json` から `"private": true` を削除し、`publishConfig.access: "public"` と
  `provenance: true` を追加（他の公開パッケージと同じ設定）
- README 等の表記を「npm に公開されるが、ユーザーは直接 import しない」に更新
- `.claude/rules/package-boundaries.md` の境界ルールも同期

ユーザー向けの API には変化なし。CLI 生成物 (`nhc-schema.ts`) が引き続き
唯一の消費者であり、ユーザーは `@notion-headless-cms/notion-orm` を
直接 import しない。
