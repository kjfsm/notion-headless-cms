import type { BaseContentItem } from "./types/content";
import type { CMSHooks, MaybePromise } from "./types/hooks";
import type { Logger } from "./types/logger";
import type { CMSPlugin } from "./types/plugin";

/**
 * プラグイン配列とダイレクトフックを合成して単一の CMSHooks を返す。
 * beforeCacheMeta / beforeCacheContent / afterRender はパイプライン（前の出力が次の入力）。
 * オブザーバー系は全員に同じ値を渡し、例外は logger に流して握りつぶす。
 */
export function mergeHooks<T extends BaseContentItem>(
  plugins: CMSPlugin<T>[],
  directHooks?: CMSHooks<T>,
  logger?: Logger,
): CMSHooks<T> {
  const allHooks: CMSHooks<T>[] = [
    ...plugins.map((p) => p.hooks ?? {}),
    ...(directHooks ? [directHooks] : []),
  ];

  if (allHooks.length === 0) return {};

  return {
    beforeCacheMeta: buildMetaPipeline(allHooks),
    beforeCacheContent: buildContentPipeline(allHooks),
    afterRender: buildRenderPipeline(allHooks),
    onCacheHit: buildObserver(allHooks, "onCacheHit", logger),
    onCacheMiss: buildObserver(allHooks, "onCacheMiss", logger),
    onCacheRevalidated: buildObserver(allHooks, "onCacheRevalidated", logger),
    onContentRevalidated: buildObserver(
      allHooks,
      "onContentRevalidated",
      logger,
    ),
    onListCacheHit: buildObserver(allHooks, "onListCacheHit", logger),
    onListCacheMiss: buildObserver(allHooks, "onListCacheMiss", logger),
    onListCacheRevalidated: buildObserver(
      allHooks,
      "onListCacheRevalidated",
      logger,
    ),
    onError: buildObserver(allHooks, "onError", logger),
    onRenderStart: buildObserver(allHooks, "onRenderStart", logger),
    onRenderEnd: buildObserver(allHooks, "onRenderEnd", logger),
  };
}

function buildMetaPipeline<T extends BaseContentItem>(
  hooks: CMSHooks<T>[],
): CMSHooks<T>["beforeCacheMeta"] {
  const fns = hooks
    .map((h) => h.beforeCacheMeta)
    .filter(Boolean) as NonNullable<CMSHooks<T>["beforeCacheMeta"]>[];
  if (fns.length === 0) return undefined;
  return async (meta) => {
    let current = meta;
    for (const fn of fns) {
      current = await (fn(current) as MaybePromise<typeof meta>);
    }
    return current;
  };
}

function buildContentPipeline<T extends BaseContentItem>(
  hooks: CMSHooks<T>[],
): CMSHooks<T>["beforeCacheContent"] {
  const fns = hooks
    .map((h) => h.beforeCacheContent)
    .filter(Boolean) as NonNullable<CMSHooks<T>["beforeCacheContent"]>[];
  if (fns.length === 0) return undefined;
  return async (content, item) => {
    let current = content;
    for (const fn of fns) {
      current = await (fn(current, item) as MaybePromise<typeof content>);
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
  logger?: Logger,
): CMSHooks<T>[K] {
  const fns = hooks.map((h) => h[key]).filter(Boolean);
  if (fns.length === 0) return undefined;
  return ((...args: unknown[]) => {
    for (const fn of fns) {
      try {
        (fn as (...a: unknown[]) => void)(...args);
      } catch (err) {
        logger?.error?.("観測フックで例外が発生", {
          hook: String(key),
          error: err instanceof Error ? err.message : String(err),
        });
      }
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
