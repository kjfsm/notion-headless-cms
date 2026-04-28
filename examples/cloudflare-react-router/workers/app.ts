/// <reference types="vite/client" />
import { createRequestHandler } from "react-router";
import { makeCms } from "../app/lib/cms";

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export default {
	async fetch(request, env, ctx) {
		return requestHandler(request, {
			cloudflare: { env, ctx },
		});
	},

	async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
		const cms = makeCms(env);
		const result = await cms.posts.cache.warm({
			onProgress: (done, total) =>
				console.log(`[scheduled] warm: ${done}/${total}`),
		});
		console.log(
			`[scheduled] warm 完了: ok=${result.ok} failed=${result.failed}`,
		);
	},
} satisfies ExportedHandler<Env>;
