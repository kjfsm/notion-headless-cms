// See https://svelte.dev/docs/kit/types#app.d.ts
import type { CloudfareCMSEnv } from "@notion-headless-cms/adapter-cloudflare";

declare global {
	namespace App {
		interface Platform {
			env: CloudfareCMSEnv;
			context: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
