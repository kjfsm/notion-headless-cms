---
"@notion-headless-cms/core": patch
"@notion-headless-cms/renderer": patch
"@notion-headless-cms/cache-r2": patch
"@notion-headless-cms/cache-next": patch
"@notion-headless-cms/adapter-cloudflare": patch
"@notion-headless-cms/adapter-node": patch
"@notion-headless-cms/adapter-next": patch
"@notion-headless-cms/cli": patch
---

ビルド・CI/CD・Wrangler 設定の基盤を改善しました。ランタイム挙動への影響はありません。

- 公開時に **npm provenance** を有効化し、各パッケージの `publishConfig` に `"provenance": true` を追加。GitHub Actions の OIDC（`id-token: write`）と連動し、sigstore 証跡付きで公開されます。
- `@notion-headless-cms/core` と `@notion-headless-cms/source-notion` の `publishConfig.exports` の冗長な重複定義を削除（通常の `exports` と一致していたため）。
