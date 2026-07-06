---
"@notion-headless-cms/react-renderer": patch
---

セキュリティ観点の修正をまとめて適用した(#480 で別途対応としていた項目)。公開 API シグネチャ・exports は不変。

- **mermaid 格納型 XSS**: `MermaidCode` の mermaid 初期化を `securityLevel: "loose"` → `"strict"` に変更。Notion 編集者が書いた図ソースのラベル HTML/クリックハンドラ経由での XSS を、mermaid 内部の DOMPurify サニタイズで防ぐ。**挙動変化**: HTML ラベルやクリックイベントを使う図はそれらが無効化される。
- **iframe スキーム注入**: `Embed`/`Pdf`/`Video`(external) の `<iframe src>` を `http(s)`/プロトコル相対のみに制限。`javascript:`/`data:text/html` 等は iframe を描画せずリンクにフォールバックする。**挙動変化**: 非 http(s) スキームの埋め込みは表示されなくなる。
- **href/img src スキーム注入**: `OgCard`/`Mention` の `<a href>`/`<img src>` を検証し、`javascript:` 等の危険なスキームを無害化(href は非リンク表示、img は非表示)。
- **移植性(Next/Node でのクラッシュ)**: `Code`/`Equation`/`InlineEquation` の SSR ガードを Vite 専用の `import.meta.env.SSR` から `typeof window` に置換。Next(webpack/turbopack)や素の Node で公開パッケージを消費した際の実行時 `TypeError` を解消する。
