#!/usr/bin/env bash
# PreToolUse: git commit 前に pnpm format を実行する
# format で差分が生じた場合は exit 2 でブロックし、Claude に git add + 再コミットを促す
set -euo pipefail

payload="$(cat)"

# tool_input.command を取り出す
if command -v jq >/dev/null 2>&1; then
	cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
else
	cmd="$(printf '%s' "$payload" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const p=JSON.parse(d);console.log((p.tool_input||{}).command||"")}catch{console.log("")}})')"
fi

# git commit を含むコマンドでなければスキップ
case "$cmd" in
	*"git commit"*) ;;
	*) exit 0 ;;
esac

cd "$(dirname "$0")/../.."

command -v pnpm >/dev/null 2>&1 || exit 0

pnpm -s format 2>/dev/null || true

# format 後に未ステージの差分があれば Claude にブロックして通知する
if ! git diff --quiet; then
	cat >&2 <<'EOF'
フォーマット適用: pnpm format によりファイルが変更されました。
git add でステージしてから再度コミットしてください。
EOF
	git diff --name-only >&2
	exit 2
fi

exit 0
