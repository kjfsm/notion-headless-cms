# Changesets

このディレクトリは [changesets](https://github.com/changesets/changesets) が管理するバージョン変更ファイルを格納します。

## バージョンアップの手順

1. 変更を実装したブランチで以下を実行する:

   ```bash
   pnpm changeset
   ```

2. 対話形式でバージョンの種類（patch / minor / major）と変更内容を入力する。

3. 生成された `.changeset/*.md` ファイルをコミットして PR に含める。

4. PR が main にマージされると、`release.yml` が自動で snapshot バージョン（`0.0.0-canary-<sha>`）を `canary` タグへ npm 公開する（Version Packages PR は作られず、changeset ファイルも消費されずに残る）。

5. 正式な `latest` リリースを出したい時は、メンテナが `release-stable.yml` を workflow_dispatch で手動起動する。保留中 changeset があれば "Version Packages" PR が自動作成され、それをマージすると全パッケージが `latest` タグで npm に自動公開される。

## bump 種別の判定基準

**既定は `patch`**。`minor` / `major` は明示的な根拠がある場合のみ選ぶ。

| 種別 | 用途 | 例 |
|---|---|---|
| `patch` | 後方互換のバグ修正 / 内部実装の改善 / ドキュメント / テスト / 依存更新 | エラーメッセージ追記、リファクタ、依存の安全な patch bump |
| `minor` | 後方互換を維持しながら**公開 API に機能を追加**する | 新しいオプション・新メソッド・新パッケージ・既存 API のオプション拡張 |
| `major` | **公開 API の破壊的変更** (既存利用側のコードが壊れる) | 関数シグネチャ変更、戻り値の型変更、オプション必須化、API 削除・改名、`engines.node` 引き上げ |

### `patch` の典型例

- 既存挙動を変えないリファクタリング・型補強
- バグ修正で挙動が「正しくなる」が利用側に互換問題が出ないもの
- ドキュメント・コメント・テストのみの変更（公開パッケージに含まれない `docs/` 等は changeset 不要）
- 内部依存の patch / minor 更新

### `minor` の典型例

- `createClient` に新オプションを追加する（既存利用側は何も変更不要）
- `CollectionClient` に新メソッドを追加
- 新しいキャッシュアダプタや新パッケージを追加
- 既存エラーコードに `nextSteps` / `docsUrl` を追加（API シェイプは増えるが既存呼び出し側は無影響）

### `major` の典型例

- 公開関数の引数を増やす（必須化）/ 型を変える
- `CMSError` のコードを廃止 / 改名
- exports サブパスの削除・改名
- `engines.node` の最小バージョン引き上げ
- ピア依存の互換範囲を狭める

### 判定に迷ったときの確認手順

1. `git diff main..HEAD -- packages/<対象>/src/**` で公開 API の差分を確認
2. `dist/index.d.mts` のシグネチャ差分を見る（`pnpm build` 後）
3. 利用側のコード（README サンプル / `examples/` / `docs/`）が**そのままビルドできるか**を確認
   - そのままで動く → `patch` or `minor`
   - 書き換えが必要 → `major`
4. `attw --pack` / `publint --strict` で型契約レベルの破壊を検出

## changeset を作らないケース

`changesets/config.json` の `ignore` 配列に入っているパッケージ（`apps/*` 配下や `examples/*` など）は対象外。`docs/` のみ / CI 設定のみ / リポジトリ運用設定のみの変更も対象外で、PR では `skip-changeset` ラベルで明示する。

公開パッケージ (`packages/*`) のコード・型・`package.json` に触れる変更は原則 changeset 必須。
