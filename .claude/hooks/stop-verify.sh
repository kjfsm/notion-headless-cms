#!/usr/bin/env bash
# Stop: 変更があれば lint + typecheck を走らせ、失敗したら exit 2 で Claude に再作業を促す
# 変更が無い場合は何もしない（無駄な CI 実行を避ける）
set -euo pipefail

cd "$(dirname "$0")/../.."

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	exit 0
fi

# 変更が 0 件なら skip
if git diff --quiet && git diff --cached --quiet; then
	exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
	exit 0
fi

err=0

# lint
if ! pnpm -s lint >/tmp/.claude-stop-lint.log 2>&1; then
	echo "Stop: pnpm lint 失敗" >&2
	tail -40 /tmp/.claude-stop-lint.log >&2 || true
	err=1
fi

# typecheck
if ! pnpm -s typecheck >/tmp/.claude-stop-typecheck.log 2>&1; then
	echo "Stop: pnpm typecheck 失敗" >&2
	tail -40 /tmp/.claude-stop-typecheck.log >&2 || true
	err=1
fi

if [ "$err" -ne 0 ]; then
	exit 2
fi

exit 0
