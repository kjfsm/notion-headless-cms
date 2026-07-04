---
"@notion-headless-cms/react-renderer": patch
---

`Code`・`Equation`・`InlineEquation` の `shiki`/`katex` 動的 import を `import.meta.env.SSR` で
ガードし、SSR/Worker バンドルから除外されるようにした。

- これらの動的 import は `useEffect` 内（ブラウザでのみ実行）にあり、実行時には SSR で
  一切走らないが、Vite の SSR ビルドは静的にこの import を到達可能とみなし、shiki の
  言語別チャンク（数百 KB〜）や katex を含む巨大なチャンクを `build/server` 側にも
  生成していた
- Cloudflare Workers 等、SSR 出力全体を 1 つのデプロイ単位としてアップロードする環境では、
  これらの未使用チャンクがそのまま Worker サイズ上限（無料プラン 3 MiB）を圧迫していた
- `import.meta.env.SSR` は Vite がビルド時に静的な真偽値へ置換する定数のため、この
  early return により後続の動的 import が SSR ビルドの到達可能グラフから外れ、
  tree-shaking で完全に除外される（ブラウザ向け client ビルドには引き続き含まれる）
