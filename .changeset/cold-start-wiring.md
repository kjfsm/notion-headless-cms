---
"@notion-headless-cms/cms": patch
---

`createCMS({ coldStart: true })` を追加した。index/entry が未マテリアライズな slug への `find()` に対し、各コレクションドライバの `retrieveBySlug`（slug プロパティの filter クエリ、または slug 未設定コレクションは page id での直接取得）を使って 1 回だけ Notion を直読みし、以後の `find()` が通常どおり index/R2 のキャッシュヒットになるようマテリアライズする（#442 の read-through フォールバック）。

既定（`coldStart` 省略時 = `false`）は従来どおり、未マテリアライズな `find()` は Notion を呼ばず `null` を返す。`syncDelegate`（DO 委譲）利用時は `coldStartFetch` を明示的に渡すことで同等の read-through を差し込める。
