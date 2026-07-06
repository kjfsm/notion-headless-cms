# 開発改善提案（短期・中期・長期）

最終更新: 2026-07-05

本リポジトリと利用側リポジトリ（euphoric-band-site）の開発履歴を横断調査し、繰り返し発生している摩擦点をもとにまとめた改善提案。各項目は実際のコミット・Issue・ファイルに根拠を持つ（推測ベースの項目は含めない）。

対象は「ライブラリとしての構成」と「開発環境・運用」。優先度は 短期（〜2週間）→ 中期（1〜2ヶ月）→ 長期（四半期〜）。

---

## 調査で確認した主な摩擦点（根拠）

### ライブラリ側（本リポジトリ）

| 摩擦点 | 根拠 |
|---|---|
| リリース事務の氾濫: 直近200コミット中 約10% が `Version Packages` PR | git log（機能コミット1件ごとにリリース PR が挟まる） |
| KV 無料枠クォータ対応が同一領域で4回連鎖 | #466 → #468 → #470 → #472（`packages/cms/src/store/index-store.ts`・`sync/coordinator.ts` 等を連続改修） |
| v3 着地直後に公開 API の後追い修正が連続 | #458（未 export 型の export）・#460（公開 API 相当の型 export）・#462（shiki/katex の SSR バンドル除外） |
| v2（16パッケージ）と v3（`cms`）の2アーキテクチャ並存保守 | `.claude/project.md`（「置き換えではなく選択」） |
| `cms` の peerDependencies に `vitest`（testing サブパスのため） | `packages/cms/package.json` |
| 「v3」内部識別子が改名後も残存 | `packages/cli/src/v3/`・`packages/react-renderer/src/v3.ts` |
| cli init の Cloudflare 配線が TODO のまま | `packages/cli/src/v3/init.ts:46-55`（DO 結線・binding 取り出し・Core 構築の3箇所） |
| 1.0 GA が attw 失敗1件でブロック、fixed mode 未設定 | `docs/_internal/1.0-progress-memo.md`（validate のみ失敗、node 版差異の疑い） |
| `RELEASE_PAT` 依存・初回公開404のローカルフォールバック手順が常設 | `.github/workflows/release.yml`・`.claude/project.md` |
| カバレッジ閾値がグローバル一律70%、v2 周辺アダプタはテスト各1本 | `vitest.config.ts`・`notion-source`/`validate`/`fetch-blocks`/`notion-katex`/`notion-shiki` |

### 利用側（euphoric-band-site）

| 摩擦点 | 根拠 |
|---|---|
| 方式転換への追従移行が履歴の主軸（v2 → 新 API → v3） | site#60/#69/#73/#74/#88 + 3.0.2〜3.0.7 追従（package.json 32回変更） |
| 壊れた publish が利用側をブロック | site#88 本文（存在しない `@notion-headless-cms/v3@0.0.0` 依存で npm 404、据え置きを強制） |
| ライブラリ不足を app 側で補うコード | `app/lib/cms-helpers.ts` の `listAll()`（RSS/sitemap/一覧/ナビで全件回収）・`remapPageLinks()`（href 書き換え） |
| `imagesPath` の意味が同期側と reader 側で異なる | site CLAUDE.md に「唯一のハマりどころ」と明記（片方は絶対パス、片方は routes からの相対） |
| workers/・DO・同期経路が完全に無テスト | KV `list()` 枯渇による本番 `GET /` 500（site#91）・OG 生成失敗（site#80）はいずれも本番で発覚 |
| 「入れて→消す」試行錯誤 | edge-cache 自前実装（site#93）→ 同日撤回（site#94）、version チェック API 追加→削除、F5 強制再取得の v3 廃止 |
| DO Worker のプレビュー URL 不可を職人芸で吸収 | `wrangler.preview.toml` 冒頭34行がほぼ回避策コメント（site#81/#82/#83 と3PR連続調整） |

---

## 短期（〜2週間: 今すぐ効く摩擦除去）

### S1. 利用側定型のライブラリ昇格（`listAll` / route pattern）

- `list()` の cursor 全件回収を `list({ all: true })` もしくは async iterator としてライブラリに追加する。RSS・sitemap・一覧・グローバルナビ・設定値コレクション（`siteTexts`/`activities`）と「全件が欲しい」ユースケースは普遍的で、利用側が毎回 `listAll()` を自作している。
- `defineCollection` に route pattern（例: `path: "/blog/:slug"`）を宣言できるようにし、同期パイプラインが内部リンク href を最初から正しく焼き込む。現状は `/${collection}/${slug}` 固定生成のため、利用側が `remapPageLinks()` で正規表現書き換えする定型が全詳細ルートに発生している。
- site#93 で自前コード→ライブラリ DI プリミティブへの置換（`readerReadOnly()`・`durableObjectSyncDelegate` 等）が進んだ実績があり、この延長線上の作業。

### S2. `imagesPath` の意味分離

同期側（絶対パスを焼き込む）と reader 側（routes からの相対パス）で同名オプションの意味が異なる。同期側を `publicImagePath` 等に改名し、型・命名レベルで区別する。利用側 CLAUDE.md に「唯一のハマりどころ」と明記されている既知の罠の根治。

### S3. publish スモークテストを PR CI に常設

`pnpm pack` → 空ディレクトリで install → 各エントリポイント（サブパス export 含む）を import する検証を PR CI に追加する。存在しない内部パッケージへの依存を含む壊れた publish（npm 404）が利用側の更新を実際にブロックした。nightly の publish-dry-run では PR マージ前に防げない。

### S4. 公開 API スナップショットの導入

api-extractor もしくは型スナップショットテストで「export 漏れ」を検出する。v3 着地直後に #458/#460 と型 export の後追い修正が連続し、利用側では `tsc -b` の「名前を付けられない型」エラーとして顕在化した。publint / attw では拾えない領域。

### S5. node バージョン固定

mise / Volta + `.node-version` で `engines >= 24` とローカル環境を一致させる。attw 失敗（validate 1件）は node 版差異の疑いで切り分けが停滞しており、1.0 ブロッカー解消の前提になる。

### S6. サイト側 CI 強化（euphoric-band-site 側で実施）

- CI に `pnpm run typecheck` と build を追加する（現状 lint + test のみで、型崩れ・バンドル肥大を CI で検知できない。過去の Worker サイズ超過 17MB → デプロイ失敗は本番手前まで気づけなかった）。
- renovate を導入し `@notion-headless-cms/*` をグループ化する（3.0.2→3.0.7 のパッチ追従を手動 PR で行っている）。

---

## 中期（1〜2ヶ月: 構造の改善）

### M1. テストハーネスの提供

KV / R2 / DO のインメモリフェイクを `@notion-headless-cms/testing`（または `cms/testing` の独立パッケージ化）として提供する。

- 利用側は workers/・SyncCoordinatorDO・同期経路が完全に無テストで、KV クォータ枯渇 500 や OG 生成失敗が本番で初めて発覚している。DO/KV/R2 依存が強すぎて利用側単独ではテストを書けないのが原因。
- あわせて `cms` の peerDependencies から `vitest` を外す（テストユーティリティのために全利用者へ vitest を要求する現状の解消）。

### M2. リリース運用の平準化

- changeset のバッチリリース運用（数機能をまとめて Version Packages）で、履歴の約10%を占めるリリース事務 PR を削減する。
- `RELEASE_PAT` → GitHub App token 化（PAT 失効・権限管理リスクの解消）。
- 「新規 scope パッケージの初回公開は CI が 404 で落ちるためローカル手動 `release:local`」という常設フォールバックの恒久解消。

### M3. 移行支援の制度化

- 破壊的変更には移行ガイドを必須化し、可能なら codemod を同梱する。利用側は v2→新API→v3 と短期間に大規模書き換えを繰り返し払っている。
- KV キー形式変更（`index:` → `entry-index:`/`list-index:`）のようなストレージ移行は、ライブラリが migration API / スクリプトを同梱する。site#91 では利用側が一回限りの `cleanup-old-kv-index.mjs` を自作する羽目になった。

### M4. cli init の Cloudflare 配線完了

`packages/cli/src/v3/init.ts` の TODO 3件（DO 結線・binding 取り出し・SyncCoordinatorCore 構築）を完了し、wrangler.toml・プレビュー用 read-only 構成（`readerReadOnly()` + DO 無し preview Worker）まで生成する。現状、利用側は wrangler.preview.toml 冒頭34行ぶんの回避策ノウハウ（no_bundle でビルド済みバンドル指定・`preview_urls=true` 明示等）を自力で獲得しており、これをテンプレとして配布すれば v3 導入体験が完成する。

### M5. 内部整合の負債解消 → 一部完了

- 「v3」内部識別子の一括リネーム（`cli/src/v3/`・`react-renderer/src/v3.ts` 等）→ **✅ 完了**（本セッションで実行。`cli/src/v3/` は `cli/src/` へ平坦化、`react-renderer/src/v3.ts` は `src/cms.ts` へリネーム済み）
- カバレッジ閾値のパッケージ別化（一律70% → 実態に合わせる）は未着手のまま残る。v2 周辺アダプタ（`notion-source`/`fetch-blocks`/`notion-katex`/`notion-shiki`）のテスト拡充は、L1 の実行（v2 全削除）により対象パッケージごと消滅したため不要になった。

---

## 長期（四半期〜: 方向性の決断）

### L1. v2/v3 の一本化判断 → ✅ 決定・実行済み

v3（`cms`）を主軸に据える方針が決定し、v2 系 13 パッケージ（`client`/`core`/`cache`/`notion-source`/`notion-orm`/`fetch-blocks`/`fetch-markdown`/`markdown-html`/`block-html`/`notion-katex`/`notion-shiki`/`testing`/`validate`）を本リポジトリから全削除した。公開パッケージ・examples・docs にまたがる2アーキテクチャ並存という最大の固定費は解消され、現行アーキテクチャは `@notion-headless-cms/cms`（と、それにのみ依存する `react-renderer`/`cli`）だけになった。移行の詳細は `docs/ja/migration/v2-removal.md` を参照。

### L2. 1.0 GA 到達と互換性ポリシーの明文化

attw 解消（S5 が前提）→ fixed mode 切替 → 1.0.0-rc → GA。あわせて SemVer 契約・非推奨期間（deprecation window）ポリシーを明文化する。`notionSource({blocks,ogp,enrichers})` の deprecation → 削除が長く尾を引いた経緯があり、利用側が安心して追従できる契約が要る。

### L3. クォータ/コストの予算モデル第一級化

#472（KV write 日次計測とソフト上限警告）の延長として、KV/R2 オペレーション数の予算・計測・警告を標準機能に昇格し、「1 リクエスト/1 同期あたりの I/O 特性」をドキュメントで保証値として公開する。KV `list()` クォータ枯渇は内部実装の I/O 特性が利用側から不可視だったために障害化してから発覚した。

### L4. ドッグフーディングループの制度化

euphoric-band-site の E2E をライブラリの canary / nightly に対して回す downstream テストを組む。利用側は事実上ライブラリのドッグフーディング環境として運用されており（site CLAUDE.md にバグ報告フローが明文化済み）、これを CI に載せれば「本番で初めて壊れる」問題を前倒しできる。

### L5. `.claude/` 規約の単一情報源化

CLAUDE.md / `.claude/project.md` / `rules/` / `hooks/` に同じ規約（core 禁止 import 等）が重複記述されており、`.claude-next/` 経由の編集フローも重い。単一情報源から生成する、もしくは整合を lint で機械維持する仕組みに寄せる。

---

## 既存提案との関係

`docs/ja/improvements.md` の未実装案（D3 Remix 向け `./remix`、D5 `nhc init` フルファイル生成、P3 画像 resize/format 変換)のうち、D5 は本提案の M4 と同一方向（M4 を優先実装すれば D5 の大部分をカバーする）。D3・P3 は需要駆動で長期枠のまま維持でよい。
