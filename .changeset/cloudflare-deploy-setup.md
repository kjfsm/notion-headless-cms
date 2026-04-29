---
"example-cloudflare-hono": patch
"example-cloudflare-astro": patch
"example-cloudflare-react-router": patch
"example-cloudflare-sveltekit": patch
---

cloudflare 系 example のデプロイ設定を整備。各 `wrangler.toml` の `[build]` コマンドに `nhc generate` を組み込み、Cloudflare GitHub App（Workers Builds）からそのままビルド・デプロイできるようにした。GitHub Actions 側にも `workflow_dispatch` で起動できる `deploy-examples-cloudflare.yml` を追加し、`example` 選択 + `dry-run` に対応。`cloudflare-hono` には no-op の `build` スクリプトを追加して 4 example のフローを統一。
