import { CMSError } from "@notion-headless-cms/cms";
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

  if (!config || typeof config !== "object" || !config.collections) {
    throw new CMSError({
      code: "cli/config_invalid",
      message:
        "nhc.config.ts は defineConfig({ collections: {...} }) の形で default export してください。",
      context: { operation: "loadConfig", configPath },
    });
  }

  return config;
}
