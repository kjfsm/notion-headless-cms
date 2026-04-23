#!/usr/bin/env bash
# SessionStart: 現在の git 状態と changeset の有無、直近コミットを短く表示
set -euo pipefail

cd "$(dirname "$0")/../.."

echo "=== セッション開始時の状態 ==="

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
	echo "ブランチ: $branch"

	# 変更サマリ
	changed_count="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
	echo "未コミット変更: $changed_count 件"

	# 直近 3 コミット
	echo ""
	echo "直近のコミット:"
	git log --oneline -3 2>/dev/null || true

	# 未マージ changeset
	if [ -d .changeset ]; then
		cs_count="$(find .changeset -maxdepth 1 -type f -name "*.md" ! -name "README.md" 2>/dev/null | wc -l | tr -d ' ')"
		echo ""
		echo "保留中の changeset: $cs_count 件"
	fi
fi

exit 0
