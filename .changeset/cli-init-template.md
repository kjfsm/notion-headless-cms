---
"@notion-headless-cms/cli": patch
---

`nhc init --template <name>` を追加。`node` / `cloudflare-react-router` / `cloudflare-hono` / `next` を選ぶと、ランタイムに合った `output` パスと「次のステップ」(追加すべき依存・binding・対応する example への導線) を出力する。未指定時の挙動 (`node` 相当) は従来どおり。
