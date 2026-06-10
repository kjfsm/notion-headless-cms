# nDash 新リポジトリ立ち上げ手引き

リポジトリ作成から M0（scaffold）完了までの手順。ツール選定は旧リポジトリで実証済みの構成を基本的に踏襲する。

## 1. 初期構成

```
ndash/
├── CLAUDE.md                  ← CLAUDE.md.draft から配置
├── docs/                      ← この立ち上げドキュメント一式をコピー
├── packages/
│   ├── ndash/                 ← 唯一の公開パッケージ（エントリ + サブパス）
│   ├── data/                  ← 内部 WS: defineCollection・型推論・typed query
│   ├── pipeline/              ← 内部 WS: PortableContent 生成・画像・リンク
│   ├── delivery/              ← 内部 WS: freshness・artifact ストア・mount ハンドラ
│   └── testing-internal/      ← 内部 WS: fake・fixture
├── examples/                  ← M5 で追加
├── pnpm-workspace.yaml
├── biome.json
├── vitest.workspace.ts
└── .github/workflows/ci.yml
```

- 内部ワークスペース（data / pipeline / delivery）は **`private: true`**。公開ビルド時に `packages/ndash` へバンドルする（公開面 1 パッケージの原則。architecture.md 1）
- レイヤ間の依存方向（adapters → delivery → pipeline → data）は lint / CI で機械的に検査する（旧リポジトリの PreToolUse hook + grep 方式を踏襲）

## 2. ツール選定（旧リポジトリからの継承と変更）

| 項目 | 選定 | 備考 |
|---|---|---|
| パッケージマネージャ | pnpm（workspace） | 継承 |
| Linter / Formatter | Biome（スペース 2・ダブルクォート・ESM のみ・`import type` 強制） | 継承 |
| テスト | vitest（coverage 70% 閾値）+ Playwright（examples E2E） | 継承 |
| バージョニング | changesets、**fixed group で全 WS 同一バージョン** | 旧リポジトリからの変更点（ADR-5） |
| ビルド | tsup または tsdown（サブパス exports + `sideEffects: false` + `files: ["dist"]`） | 内部 WS のバンドル統合が要件 |
| CI | GitHub Actions: typecheck / lint / test / 依存方向検査 / changeset 検査 | 継承 |
| Node engines | **要再検討**: 旧リポジトリは `>=24` だが理由が文書化されていなかった。LTS を下限にするか、`>=24` を選ぶなら理由（`--env-file` 依存等）を README に明記する | — |

## 3. 開発規約（旧リポジトリから継承）

- コミットメッセージ・PR タイトル・PR 概要・ドキュメントは**日本語**。ブランチ名は英語のみ。識別子・型名・ログは英語
- 変更後は必ず typecheck と関連テストを通す。`main` 直 push 禁止
- シークレットをコード・Git・ログに入れない（`.dev.vars` / `.env` は gitignore）
- pre-commit フックを `--no-verify` でスキップしない
- 自動生成ファイルを手編集しない

nDash 固有の絶対ルール（直列化可能性・公開面 1 パッケージ・dead option 禁止）は [CLAUDE.md.draft](./CLAUDE.md.draft) を参照。

## 4. 立ち上げチェックリスト

### リポジトリ作成

- [ ] GitHub リポジトリ `ndash` を作成（説明文: 「Notion を書き換えると、サイトに反映される — Notion live publishing engine」）
- [ ] この `docs/ndash/` 一式を新リポジトリの `docs/` にコピー
- [ ] `CLAUDE.md.draft` をルートに `CLAUDE.md` として配置
- [ ] `main` ブランチ保護（直 push 禁止・CI 必須）

### 名前の確保

- [ ] npm `ndash` をプレースホルダ公開して確保（2026-06 時点で空きを確認済み。`n-dash` と `emdash` は取得済みのため不可）
- [ ] 将来分離する可能性のある `notion-data`（空き確認済み）は確保するか判断（ADR-2）

### scaffold（M0）

- [ ] pnpm workspace + 上記ディレクトリ構成
- [ ] Biome / vitest / changesets（fixed group）/ tsconfig（verbatimModuleSyntax）
- [ ] CI（typecheck / lint / test / 依存方向検査）が green
- [ ] `packages/ndash` が空の `createDash` スタブを export し、`pnpm build` でサブパス exports が解決される
- [ ] 直列化可能性のテストハーネス（公開 API の戻り値に対する `structuredClone` ラウンドトリップ検査）の雛形を置く

### 移植の開始（M1 以降）

- [ ] [reuse-map.md](./reuse-map.md) の「A. そのまま移植」から着手（errors → image → fetcher/transformer の順が依存が少ない）
- [ ] 移植時は旧リポジトリのテストも一緒に運ぶ

## 5. 旧リポジトリの扱い

- notion-headless-cms は nDash の 1.0 まで現状維持（致命バグ修正のみ）
- nDash 1.0 公開時に旧 README へ案内を追記し、メンテナンスモードを宣言（roadmap.md「1.0」）
- 旧 docs の RFC（`docs/ja/rfc/v2-usability-redesign.md`）は設計判断の歴史として残す
