---
"@notion-headless-cms/cache-kv": patch
---

0.1.1 で npm 公開時に tarball へ `dist/` が含まれず import に失敗していた不具合を再公開で解消。Version Packages PR に対する `publish --dry-run` ワークフローを追加し、同種の事故を CI で事前検知できるようにした。
