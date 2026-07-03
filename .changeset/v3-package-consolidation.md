---
"@notion-headless-cms/react-renderer": patch
"@notion-headless-cms/cli": patch
---

`packages/v3`（非公開ステージングパッケージ）を正式な公開パッケージ `@notion-headless-cms/cms` へ昇格した（パッケージ統合、#437 S10 の積み残し）。

- `@notion-headless-cms/cms`: `packages/v3` から改名・公開。exports を `.` / `./html`（HTML 文字列レンダラ）/ `./cloudflare`（`kvDocStore`/`r2BlobStore`）/ `./node`（`fileDocStore`/`fileBlobStore`）/ `./testing`（契約テストユーティリティ）に再編し、`publint`/`attw`/`release:local` を追加した。初回公開のためこの changeset ではバージョンを管理しない（`package.json` の `0.1.0` がそのまま初版になる）
- `react-renderer`/`cli`: `@notion-headless-cms/v3` への依存を `@notion-headless-cms/cms` に更新（パッケージ名変更に追随するのみ、挙動に変更なし）

`packages/v3/src/render/index.ts` は `./html` サブパス新設に伴い到達不能になったため削除した。RFC（`docs/ja/rfc/v3-architecture.md`）記載の `./react` サブパスは追加しない — 該当機能は `react-renderer` の既存 `./v3` サブパスで提供済みで、`cms` 側に追加すると循環依存になるため。
