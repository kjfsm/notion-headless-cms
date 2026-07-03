---
"@notion-headless-cms/cms": patch
"@notion-headless-cms/cli": patch
---

スキーマのプロパティキーと実際の Notion プロパティ名が食い違う場合に値が取得できなかった不具合を修正した。

- `@notion-headless-cms/cms`: `prop.*()` ビルダーが末尾引数で実際の Notion プロパティ名を受け取れるようになった（例: `prop.title("名前")`）。`mapProperties()`・`notion-driver.ts` の `slugOf()`/`statusOf()` がこの別名で `raw` プロパティを解決するよう修正
- `@notion-headless-cms/cli`: `nhc.config.ts` の `v3.collections[].fieldMappings` を追加。`nhc pull` が明示マッピングまたは自動フォールバック識別子に対して `notion` 別名を生成コードへ埋め込むようになり、`nhc check` も同じ解決順で drift を照合する
