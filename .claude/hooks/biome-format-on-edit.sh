#!/usr/bin/env bash
# PostToolUse: Write/Edit のたびに Biome でリポジトリ全体を整形する。
# biome.json の設定（ignore など）に従うため、パス判定はスクリプト側で行わない。
# 全ファイル対象でも biome は十分高速（~200ms / 163 ファイル）。
# 失敗は warn 扱い（exit 0）。
set -euo pipefail

cd "$(dirname "$0")/../.."

if command -v pnpm >/dev/null 2>&1; then
	pnpm exec biome check --write >/dev/null 2>&1 || true
fi

exit 0
