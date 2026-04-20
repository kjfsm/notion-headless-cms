import type { CloudfareCMSEnv } from "@notion-headless-cms/adapter-cloudflare";

declare module "react-router" {
	interface AppLoadContext {
		cloudflare: {
			env: CloudfareCMSEnv;
			ctx: ExecutionContext;
		};
	}
}
