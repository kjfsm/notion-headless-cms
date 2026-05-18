---
name: pkg-context
description: 指定パッケージで作業を始めるのに必要十分な情報（deps / 公開 API / 関連 rules / 直近 CHANGELOG）を最小トークンで会話コンテキストに注入する。Explore agent を起動せず初期探索コストを抑える
disable-model-invocation: true
allowed-tools:
  - Read
  - Glob
  - Bash(ls:*)
---

# /pkg-context &lt;name&gt; — パッケージ要約注入

## 目的

`packages/<name>/` で作業を始める前に、Explore agent を回さず**最小ファイルだけ Read** して文脈を確立する。深掘りが必要になってから初めて Explore に切り替える。

`<name>` は `@notion-headless-cms/` プレフィクスなしの短名（例: `core`, `cache-r2`, `notion-source`）。

## 実行手順

以下の順で **Read のみ** を使い、それぞれ短く要点を整理してから次に進む。

### 1. 公開メタデータ

```
Read packages/<name>/package.json
```

抜き出す項目だけ会話に残す:
- `name`
- `dependencies` / `peerDependencies` / `devDependencies`（バージョン番号は省略可）
- `exports`（公開エントリの形）

### 2. 公開 API 表面

```
Read packages/<name>/src/index.ts
```

実装には踏み込まず、**re-export と公開シンボルだけ**列挙する。
`src/internal/**` は **読まない**（`.claude/rules/package-boundaries.md` 参照）。

### 3. 該当パッケージのルール

```
ls .claude/rules/
```

`<name>` または所属層名（`core` / `cache` / `cloudflare` / `cli` / `adapter` / `source-notion` / `error-handling` / `testing` 等）に対応する rule を Read する。

例:
- `core` → `core.md` + `package-boundaries.md`
- `cache-r2` → `cache.md` + `cloudflare.md`
- `notion-source` → `source-notion.md` + `adapter.md`

該当が無ければ `package-boundaries.md` のみで足りる。

### 4. 直近の変更コンテキスト

```
Read packages/<name>/CHANGELOG.md  (offset=0 limit=40)
```

存在しなければスキップ。最新 1〜2 リリースの bullet だけ拾う。

## ここで止める / Explore に切る境界

- ステップ 1〜4 で「触る関数の場所が見当つく」状態になればこの skill は完了。実装の修正に入る
- 公開 API から実装の追跡が必要、複数ファイルにまたがる横断調査が必要、テストパターンの実例を多数比較したい → **Explore agent に委ねる**

## 期待効果

- 単一パッケージの修正なら Explore agent 1 回分（数千トークン）を節約
- `.claude/rules/<area>.md` の `paths:` トリガに依らず確実に該当 rule を読み込める
