#!/usr/bin/env bash
# PreToolUse: packages/core/src/** に、禁止 import が混入する書き込みを block
# 禁止: @notionhq/client / unified / remark-* / rehype-* / zod / @notion-headless-cms/renderer
# 失敗時: exit 2 でブロックし、修正方針を Claude に返す
set -euo pipefail

payload="$(cat)"

if command -v jq >/dev/null 2>&1; then
	file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')"
	content="$(printf '%s' "$payload" | jq -r '.tool_input.content // .tool_input.new_string // empty')"
else
	file_path="$(printf '%s' "$payload" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log((JSON.parse(d).tool_input||{}).file_path||"")}catch{console.log("")}})')"
	content="$(printf '%s' "$payload" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const t=(JSON.parse(d).tool_input||{});console.log(t.content||t.new_string||"")}catch{console.log("")}})')"
fi

[ -z "$file_path" ] && exit 0

case "$file_path" in
	*/packages/core/src/*)
		;;
	*)
		exit 0
		;;
esac

[ -z "$content" ] && exit 0

# 静的 import のみ検出（動的 import() / import("...") は許可）
forbidden='import[[:space:]].*from[[:space:]]*["'"'"']((@notionhq/client|unified|remark-[a-zA-Z0-9-]+|rehype-[a-zA-Z0-9-]+|zod|@notion-headless-cms/renderer))["'"'"']'

if printf '%s' "$content" | grep -Eq "$forbidden"; then
	cat >&2 <<EOF
ブロック: packages/core は外部ランタイムに静的依存してはいけません。
パス: $file_path
禁止: @notionhq/client / unified / remark-* / rehype-* / zod / @notion-headless-cms/renderer からの静的 import
代替案:
  - renderer は CreateCMSOptions.renderer (RendererFn) 経由で注入する
  - アダプタ側 (packages/adapter-*) で依存する
  - フォールバックが必要なら動的 import("@notion-headless-cms/renderer") を使う
詳細: .claude/rules/core.md
EOF
	exit 2
fi

exit 0
