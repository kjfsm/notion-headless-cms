#!/usr/bin/env bash
# UserPromptSubmit: 日本語ルールを 1 行で思い出させる
# トークン最小化のため長文にしない
set -euo pipefail

cat <<'EOF'
[リマインド] コメント・コミットメッセージ・PR 概要はすべて日本語。変更後は pnpm typecheck && pnpm test を実行すること。
EOF

exit 0
