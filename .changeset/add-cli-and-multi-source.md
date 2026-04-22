---
"@notion-headless-cms/cli": patch
"@notion-headless-cms/adapter-node": patch
"@notion-headless-cms/adapter-cloudflare": patch
---

CLI ツール（nhc generate / nhc init）とマルチソースクライアントを追加

- `@notion-headless-cms/cli` を新規追加。`nhc generate` で Notion DB を introspect して `nhc-schema.ts` を生成し、`nhc init` で設定ファイルテンプレートを生成する
- `createNodeMultiCMS` を `adapter-node` に追加。`nhcSchema` から各ソースの `CMS<T>` インスタンスをまとめて生成する
- `createCloudflareCMSMulti` を `adapter-cloudflare` に追加。Workers 向けのマルチソースファクトリ
- `sources` オプションで `published` / `accessible` をクライアント作成時に差し込めるようにし、生成ファイルを編集不要にした
