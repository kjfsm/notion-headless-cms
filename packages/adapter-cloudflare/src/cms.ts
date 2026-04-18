import { createCloudflareR2StorageAdapter } from "@notion-headless-cms/cache-r2";
import type { CMSConfig, CMSEnv } from "@notion-headless-cms/core";
import { CMS } from "@notion-headless-cms/core";

export interface CloudflareCMSEnv extends CMSEnv {
	CACHE_BUCKET?: R2Bucket;
}

/**
 * Cloudflare Workers 向け CMS ファクトリ。
 * env.CACHE_BUCKET (R2Bucket) を StorageAdapter に変換して CMS に注入する。
 * CACHE_BUCKET が未設定の場合はキャッシュなしで動作する（ローカル開発向け）。
 */
export function createCloudflareCMS(
	env: CloudflareCMSEnv,
	config?: Omit<CMSConfig, "storage" | "env">,
): CMS {
	return new CMS({
		...config,
		env: {
			NOTION_TOKEN: env.NOTION_TOKEN,
			NOTION_DATA_SOURCE_ID: env.NOTION_DATA_SOURCE_ID,
		},
		storage: createCloudflareR2StorageAdapter(env.CACHE_BUCKET),
	});
}
