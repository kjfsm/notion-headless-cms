// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Env } from "$lib/cms";

declare global {
  namespace App {
    interface Platform {
      env: Env;
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }
  }
}
