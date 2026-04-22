import type { NHCConfig } from "./index.js";

export async function loadConfig(configPath: string): Promise<NHCConfig> {
	const { createJiti } = await import("jiti");
	const jiti = createJiti(import.meta.url);
	const mod = (await jiti.import(configPath)) as
		| { default?: NHCConfig }
		| NHCConfig;

	const config = (mod as { default?: NHCConfig }).default ?? (mod as NHCConfig);

	if (!config || !Array.isArray((config as NHCConfig).dataSources)) {
		throw new Error(
			`設定ファイルが不正です。defineConfig() の戻り値を default export してください。\nPath: ${configPath}`,
		);
	}

	return config as NHCConfig;
}
