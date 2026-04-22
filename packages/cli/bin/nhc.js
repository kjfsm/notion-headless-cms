#!/usr/bin/env node
// dist/cli.js は pnpm build 後に生成されます。
// このファイルが bin エントリとして存在することで pnpm install 時にシンボリックリンクが作成されます。
import("../dist/cli.js").catch(() => {
	process.stderr.write(
		"[nhc] CLI がビルドされていません。以下を実行してください:\n" +
			"  pnpm --filter=@notion-headless-cms/cli build\n",
	);
	process.exit(1);
});
