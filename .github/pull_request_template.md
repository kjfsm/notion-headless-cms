## 概要

<!-- 何を変更するか、なぜ変更するかを日本語で 2-3 行 -->

## 変更内容

<!-- 主要な差分を箇条書きで -->

-
-

## 影響範囲

<!-- 影響を受けるパッケージをチェック -->

- [ ] `@notion-headless-cms/core`
- [ ] `@notion-headless-cms/notion-source`
- [ ] `@notion-headless-cms/notion-orm`
- [ ] `@notion-headless-cms/cache`
- [ ] `@notion-headless-cms/markdown-html`
- [ ] `@notion-headless-cms/block-html`
- [ ] `@notion-headless-cms/react-renderer`
- [ ] `@notion-headless-cms/client`
- [ ] `@notion-headless-cms/cli`
- [ ] `@notion-headless-cms/testing`
- [ ] docs のみ
- [ ] examples のみ
- [ ] CI / 設定のみ

## changeset

- [ ] `pnpm changeset` で changeset を作成した
- [ ] このPR は changeset 不要（`skip-changeset` ラベルを付与）

### 破壊的変更 (major) チェック

破壊的変更が含まれる場合、以下を確認したうえで `major` を選ぶ:

- [ ] 公開 API（関数シグネチャ / 型 / exports サブパス）が変わる
- [ ] 既存利用側のコード書き換えが必要になる
- [ ] CHANGELOG に移行手順を書いた / 書く予定がある
- [ ] 該当しない（後方互換 — `patch` または `minor`）

詳細な判定基準: [`.changeset/README.md`](../.changeset/README.md#bump-種別の判定基準)

## テスト

<!-- 追加・更新したテスト、手動確認の手順など -->

- [ ] `pnpm typecheck && pnpm test` がローカルで成功
- [ ] 関連する README / docs を同じ PR で更新した（公開 API 変更時）

## 関連 Issue

<!-- Close #XXX など -->
