import { CMSError } from "@notion-headless-cms/core";
import type { CMSConfig } from "./index.js";

export async function loadConfig(configPath: string): Promise<CMSConfig> {
	const { createJiti } = await import("jiti");
	const jiti = createJiti(import.meta.url);
	const mod = await jiti.import<{ default?: CMSConfig } | CMSConfig>(
		configPath,
	);

	// default export 優先、無ければ module 自体を config として扱う
	const config = (
		mod && typeof mod === "object" && "default" in mod && mod.default
			? mod.default
			: mod
	) as CMSConfig;

	if (
		!config ||
		typeof config.collections !== "object" ||
		config.collections === null
	) {
		throw new CMSError({
			code: "cli/config_invalid",
			message:
				"設定ファイルが不正です。defineConfig() の戻り値 (collections を含む) を default export してください。",
			context: { operation: "loadConfig", configPath },
		});
	}

	if (!config.output) {
		throw new CMSError({
			code: "cli/config_invalid",
			message:
				'設定ファイルに output の指定が必要です。例: output: "./app/generated/nhc-schema.ts"',
			context: { operation: "loadConfig", configPath },
		});
	}

	return config;
}
