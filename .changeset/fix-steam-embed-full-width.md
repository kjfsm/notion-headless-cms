---
"@notion-headless-cms/react-renderer": patch
---

Steam 埋め込みをコンテンツ全幅に修正。固定幅 646px の指定を外し、コンテンツ幅に追従するよう変更した。

また `tailwindcss` を optional peerDependency として追加した（`theme.css` の `@source`/`@theme` ディレクティブが要求するため）。
