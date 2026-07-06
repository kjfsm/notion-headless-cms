---
"@notion-headless-cms/cli": minor
---

`nhc init` の生成物を KV から D1 に追随させた。`generateWranglerToml`/`generateMountCodeTemplate` は `kv_namespaces`（`DOC_INDEX`）ではなく `d1_databases`（既定 binding 名 `DB`）を生成し、マウントコードは `@notion-headless-cms/sql/d1` の `d1IndexStore(env.DB, schema)` を使う。`InitScaffoldOptions.kvBinding` は `d1Binding` に改名した。

`nhc doctor` の binding 診断（`DoctorInput.bindings`）も `kv` を `d1` に改名し、`wrangler.toml` の宣言チェックを `kv_namespaces` から `d1_databases` に変更した。
