---
"@notion-headless-cms/react-renderer": patch
"@notion-headless-cms/cli": patch
---

v3（#437）に不足していた数式・シンタックスハイライト・高度なHTML・マルチソースの実装を `packages/v3`（非公開ステージングパッケージ）に追加し、既存パッケージに橋渡しを追加した。

- `react-renderer`: `Code.tsx` にクライアント遅延 shiki ハイライトを追加（`__cachedHtml` が無い場合、水和後に動的 import してハイライトする。既定はページアクセス時のレンダリングで Worker の CPU 予算を消費しない）。`InlineEquation`/`RichText` が同期時に事前組版された数式 `__cachedHtml` を受け取れるようにした。`Bookmark`/`LinkPreview` に `useOgp` フックを追加し、`block.ogp` が無い場合に `NotionRenderer` の `ogpEndpoint` 経由でページアクセス時に OGP メタデータを取得できるようにした
- `cli`: `nhc.config.ts` に `v3` セクションを追加し、`nhc pull`（Notion DB introspect → `defineCollection` 雛形生成、既存ファイルは上書きしない）と `nhc check`（TS スキーマと実 DB の drift 検証、CI 向け）を新設した

`packages/v3` 側の主な追加（非公開のため changeset 対象外）:
- `transforms/{shiki,katex}.ts`: 同期時の事前レンダー用 TransformStage（オプトイン）
- `render/{html,embeds}.ts` 拡張: table/column/synced/child/bookmark/embed/link_preview/video/audio/file/pdf 等の HTML 出力、OGP はシェルのみ返しページアクセス時に取得する設計
- `http/ogp.ts`: OGP エンドポイント（SSRF ガード・redirect 追跡・edge cache 対応）
- `sync/{notion-driver,multi-source,page-index}.ts`: 複数コレクション（複数 data_source_id）を単一の同期エンジンで束ねるマルチソース実装
- `cms/create-cms.ts`: schema からドライバ・同期・HTTP ハンドラを一括結線する `createCMS()` ファクトリ
