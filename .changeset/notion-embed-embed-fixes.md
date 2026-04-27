---
"@notion-headless-cms/notion-embed": patch
---

埋め込みブロックの描画修正と oEmbed 採用

- **iframe サニタイズ修正**: `iframe` タグが基本スキーマに含まれていなかったため PDF・CodePen などの埋め込みが空白になっていた問題を修正
- **外部 MP4 動画**: 外部 URL の `video` ブロックで `.mp4/.webm/.ogg/.mov` は `<video>` タグで描画するよう変更
- **YouTube card の oEmbed 採用**: YouTube はボット対策で OGP をブロックするため `fetchOgp` を廃止し oEmbed エンドポイントを使用。実際の動画タイトル・サムネイルが取得できるように
- **YouTube / Vimeo の OGP/URL 解析コード削減**: Vimeo の `VIMEO_RE` 正規表現を oEmbed で置き換え
- **OGP 失敗時のフォールバック**: `bookmark` ブロックで OGP 取得失敗時のタイトルを生 URL からホスト名に変更し、`nhc-bookmark--no-ogp` クラスを付与
