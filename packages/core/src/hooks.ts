import type { BaseContentItem } from "./types/content";
import type { CMSHooks, MaybePromise } from "./types/hooks";
import type { Logger } from "./types/logger";
import type { CMSPlugin } from "./types/plugin";

/**
 * プラグイン配列とダイレクトフックを合成して単一の CMSHooks を返す。
 * beforeCache / afterRender はパイプライン（前の出力が次の入力）。
 * onCacheHit などオブザーバー系は全員に同じ値を渡す。
 */
export function mergeHooks<T extends BaseContentItem>(
	plugins: CMSPlugin<T>[],
	directHooks?: CMSHooks<T>,
): CMSHooks<T> {
	const allHooks: CMSHooks<T>[] = [
		...plugins.map((p) => p.hooks ?? {}),
		...(directHooks ? [directHooks] : []),
	];

	if (allHooks.length === 0) return {};

	return {
		beforeCache: buildPipeline(allHooks, "beforeCache"),
		afterRender: buildRenderPipeline(allHooks),
		onCacheHit: buildObserver(allHooks, "onCacheHit"),
		onCacheMiss: buildObserver(allHooks, "onCacheMiss"),
		onListCacheHit: buildObserver(allHooks, "onListCacheHit"),
		onListCacheMiss: buildObserver(allHooks, "onListCacheMiss"),
		onError: buildObserver(allHooks, "onError"),
	};
}

function buildPipeline<T extends BaseContentItem>(
	hooks: CMSHooks<T>[],
	key: "beforeCache",
): CMSHooks<T>["beforeCache"] {
	const fns = hooks.map((h) => h[key]).filter(Boolean) as NonNullable<
		CMSHooks<T>["beforeCache"]
	>[];
	if (fns.length === 0) return undefined;
	return async (item) => {
		let current = item;
		for (const fn of fns) {
			current = await (fn(current) as MaybePromise<typeof item>);
		}
		return current;
	};
}

function buildRenderPipeline<T extends BaseContentItem>(
	hooks: CMSHooks<T>[],
): CMSHooks<T>["afterRender"] {
	const fns = hooks.map((h) => h.afterRender).filter(Boolean) as NonNullable<
		CMSHooks<T>["afterRender"]
	>[];
	if (fns.length === 0) return undefined;
	return async (html, item) => {
		let current = html;
		for (const fn of fns) {
			current = await (fn(current, item) as MaybePromise<string>);
		}
		return current;
	};
}

function buildObserver<T extends BaseContentItem, K extends keyof CMSHooks<T>>(
	hooks: CMSHooks<T>[],
	key: K,
): CMSHooks<T>[K] {
	const fns = hooks.map((h) => h[key]).filter(Boolean);
	if (fns.length === 0) return undefined;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return ((...args: unknown[]) => {
		for (const fn of fns) {
			(fn as (...a: unknown[]) => void)(...args);
		}
	}) as CMSHooks<T>[K];
}

/** プラグイン配列とダイレクトロガーを合成して単一の Logger を返す。 */
export function mergeLoggers(
	plugins: Array<{ logger?: Partial<Logger> }>,
	directLogger?: Logger,
): Logger | undefined {
	const loggers: Partial<Logger>[] = [
		...plugins.map((p) => p.logger ?? {}),
		...(directLogger ? [directLogger] : []),
	];
	if (loggers.length === 0) return undefined;

	const merged: Logger = {};
	for (const level of ["debug", "info", "warn", "error"] as const) {
		const fns = loggers.map((l) => l[level]).filter(Boolean) as NonNullable<
			Logger[typeof level]
		>[];
		if (fns.length > 0) {
			merged[level] = (message, context) => {
				for (const fn of fns) fn(message, context);
			};
		}
	}
	return merged;
}
