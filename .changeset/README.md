# Changesets

このディレクトリは [changesets](https://github.com/changesets/changesets) が管理するバージョン変更ファイルを格納します。

## バージョンアップの手順

1. 変更を実装したブランチで以下を実行する：

   ```bash
   pnpm changeset
   ```

2. 対話形式でバージョンの種類（patch / minor / major）と変更内容を入力する。

3. 生成された `.changeset/*.md` ファイルをコミットして PR に含める。

4. PR が main にマージされると、GitHub Actions がバージョンアップ PR（"chore: バージョンアップ"）を自動作成する。

5. バージョンアップ PR をマージすると、全パッケージが GitHub Packages に自動公開される。
