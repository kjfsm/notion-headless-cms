#!/usr/bin/env bash
# PreToolUse: Write/Edit が dist/ / generated/ / .turbo/ / pnpm-lock.yaml / .dev.vars に向いたら block
# 失敗時: exit 2 でブロックし、Claude に理由を返す
set -euo pipefail

payload="$(cat)"

# tool_input.file_path を取り出す（jq が無い環境でも動くよう node でフォールバック）
if command -v jq >/dev/null 2>&1; then
	file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')"
else
	file_path="$(printf '%s' "$payload" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log((JSON.parse(d).tool_input||{}).file_path||"")}catch{console.log("")}})')"
fi

[ -z "$file_path" ] && exit 0

case "$file_path" in
	*/dist/*|*/generated/*|*/.turbo/*|*/pnpm-lock.yaml|*/.dev.vars)
		cat >&2 <<EOF
ブロック: 保護されたパスへの書き込みは禁止されています。
パス: $file_path
対象: dist/ / generated/ / .turbo/ / pnpm-lock.yaml / .dev.vars
ソース側を編集するか、ビルド/生成コマンド（pnpm build, nhc generate 等）を実行してください。
EOF
		exit 2
		;;
esac

exit 0
