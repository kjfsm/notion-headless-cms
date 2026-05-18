---
name: notion-fixtures
description: Notion API レスポンス（BlockObjectResponse / PageObjectResponse / DataSourceObjectResponse）のテスト用最小モックファクトリを提供する。`.claude/rules/testing.md` を補完し、テスト追記時の定型コード送信を削減する
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
---

# /notion-fixtures — Notion API モック雛形

## 目的

`.claude/rules/testing.md` のモックパターンは揃っているが、`BlockObjectResponse` / `PageObjectResponse` の**フィールド網羅した最小値**まではテンプレ化されていない。テスト追記のたびに `baseBlock`・`text()` ヘルパー等を書き起こすのはトークン消費が大きい。

この skill は雛形ファクトリを `.claude/skills/notion-fixtures/fixtures/` に用意し、必要なテストへ**コピー**して使う運用にする。

## 重要: import せずコピーする

`packages/core` はゼロ依存ルール（`.claude/rules/core.md`）があるため、skill 配下のファイルを**ランタイム import してはいけない**。
必ず**対象パッケージ内の `__tests__/__fixtures__/` にコピー**して使う。

例:

```
cp .claude/skills/notion-fixtures/fixtures/block.ts \
   packages/<pkg>/src/__tests__/__fixtures__/notion-block.ts
```

コピー後、不要なファクトリは削って各パッケージ流儀に合わせる。

## 提供しているファクトリ

- `fixtures/block.ts` — `baseBlock` / `richText()` / `paragraph()` / `heading()` / `image()` / `code()` / `asBlock()`
- `fixtures/page.ts` — `basePage()` / `pageWithProperties()` / `asPage()`
- `fixtures/database.ts` — `baseDataSource()` / `asDataSource()`

いずれも overrides 引数で必要フィールドだけ差し替えられる構造。

## 使い方の流れ

1. テスト追記したい `packages/<pkg>/src/__tests__/<x>.test.ts` を確認
2. 上記から必要な fixtures をコピー
3. `.claude/rules/testing.md` のパターン（DataSource モック / renderer モック / R2 fake / fetch mock）と組み合わせて記述
4. `pnpm --filter @notion-headless-cms/<pkg> test` で検証

## いつ使わないか

- 既存テストファイルに同種 fixture が**すでに**ある場合 → そちらを再利用
- block-html / react-renderer のように各種 block 型を網羅して比較したいテスト → 既存の `baseBlock` パターンが整っているのでそれに倣う
