#!/usr/bin/env bash
# PostToolUse: Write/Edit で触ったファイルに Biome check --write をかける
# 失敗は warn 扱い（exit 0）。format 後に再編集されて構わない
set -euo pipefail

payload="$(cat)"

if command -v jq >/dev/null 2>&1; then
	file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')"
else
	file_path="$(printf '%s' "$payload" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log((JSON.parse(d).tool_input||{}).file_path||"")}catch{console.log("")}})')"
fi

[ -z "$file_path" ] && exit 0
[ ! -f "$file_path" ] && exit 0

# Biome が扱う拡張子のみ対象
case "$file_path" in
	*.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.jsonc|*.css)
		;;
	*)
		exit 0
		;;
esac

# 生成物は Biome 対象外
case "$file_path" in
	*/dist/*|*/generated/*|*/.turbo/*)
		exit 0
		;;
esac

# ワークスペースルート直下で実行
cd "$(dirname "$0")/../.."

if command -v pnpm >/dev/null 2>&1; then
	pnpm exec biome check --write --no-errors-on-unmatched "$file_path" >/dev/null 2>&1 || true
fi

exit 0
