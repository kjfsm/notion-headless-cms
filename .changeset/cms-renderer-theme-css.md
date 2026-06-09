---
"@notion-headless-cms/react-renderer": patch
---

既定テーマ `@notion-headless-cms/react-renderer/theme.css` を追加。`@import` 1 行で `@source`（dist スキャン）・shadcn トークンの `@theme inline` ブリッジ・ライト/ダーク既定パレットがまとめて入るようにし、利用側がトークン定義を書き忘れて引用・コールアウト等が無色になる問題を解消する。色変更は import 後の `:root` 上書きで行える。README のスタイリング節も刷新。
