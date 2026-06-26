---
"@notion-headless-cms/core": patch
---

buildPageIndex / buildPageLinkMap が data コレクション（kind: "data"）に対して無駄な list() を発行していた問題を修正。リンク逆引きは slug を持つ page コレクションのみが対象のため、find を持たない data コレクションを自動的に走査対象から除外する。これにより記事ページ等で services / availability などの data コレクションが list されなくなる。
