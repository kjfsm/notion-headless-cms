#!/bin/bash
set -euo pipefail

# リモート環境（Claude Code on the web）でのみ実行
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# --frozen-lockfile 失敗に備え --no-frozen-lockfile でインストール
# （ロックファイルと設定の不一致が起きた場合でも安全に復旧できる）
pnpm install --no-frozen-lockfile
