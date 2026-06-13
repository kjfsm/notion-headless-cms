import { CMSError, isCMSError } from "@notion-headless-cms/core";
import { validateCMSConfig } from "@notion-headless-cms/validate";
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

  try {
    validateCMSConfig(config);
  } catch (err) {
    if (isCMSError(err) && err.code === "core/schema_invalid") {
      throw new CMSError({
        code: "cli/config_invalid",
        message: err.message,
        cause: err,
        context: { operation: "loadConfig", configPath },
      });
    }
    throw err;
  }

  return config;
}
