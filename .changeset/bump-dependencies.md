---
"@notion-headless-cms/cli": patch
---

依存関係を更新: `commander` を v14 から v15 に上げた（CLI は ESM only・Node 24+ のため互換）。あわせて開発・CI 依存（biome / vitest / turbo / knip / shadcn / tsdown / @types/node / hono catalog）と GitHub Actions（codecov-action v7 / upload-artifact v7）を更新し、ws をセキュリティ修正済みの 8.20.1 以上へ override で底上げした。
