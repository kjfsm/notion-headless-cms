// See https://svelte.dev/docs/kit/types#app.d.ts
import type { CloudflareCMSEnv } from "@notion-headless-cms/adapter-cloudflare";

declare global {
	namespace App {
		interface Platform {
			env: CloudflareCMSEnv;
			context: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
	}
}
