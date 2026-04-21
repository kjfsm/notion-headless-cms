import type { CloudflareCMSEnv } from "@notion-headless-cms/adapter-cloudflare";

declare module "react-router" {
	interface AppLoadContext {
		cloudflare: {
			env: CloudflareCMSEnv;
			ctx: ExecutionContext;
		};
	}
}
