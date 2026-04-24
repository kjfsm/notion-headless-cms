---
"@notion-headless-cms/cache-kv": patch
---

npm 公開時に tarball へ `dist/` が含まれない不具合を修正。`prepublishOnly` で publish 直前にビルドを強制するようにした。
