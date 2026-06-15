/**
 * `@notion-headless-cms/validate`
 *
 * `createClient` / `notionSource` / CLI 設定の実行時検証を zod で行う opt-in パッケージ。
 * core はゼロ依存ルールに従い zod を直接読み込まないため、検証が欲しい呼び出し側がこの
 * パッケージを明示的にインストールして利用する。
 *
 * 提供する API:
 *
 * - `validateCreateClientOptions(opts)` — `createClient({...})` の引数を検証
 * - `validateNotionSourceConfig(opts)` — `notionSource({...})` の引数を検証
 * - `validateCMSConfig(config)` — `nhc.config.ts` の defineConfig() 戻り値を検証
 *
 * いずれも検証失敗時は `CMSError(code: "core/schema_invalid")` を throw する。
 */
import { CMSError } from "@notion-headless-cms/core";
import { z } from "zod";

const loggerSchema = z
  .object({
    debug: z.function().optional(),
    info: z.function().optional(),
    warn: z.function().optional(),
    error: z.function().optional(),
  })
  .passthrough();

const cacheAdapterSchema = z
  .object({
    name: z.string().min(1, "CacheAdapter.name は空にできません"),
    handles: z
      .array(z.enum(["document", "image"]))
      .min(1, "CacheAdapter.handles は少なくとも 1 要素必要です"),
    doc: z.unknown().optional(),
    img: z.unknown().optional(),
  })
  .passthrough();

const collectionDefSchema = z
  .object({
    kind: z.enum(["page", "data"]).optional(),
    source: z.unknown().refine((v) => v != null, {
      message: "collection.source は必須です",
    }),
    slugField: z
      .string()
      .min(1, "collection.slugField は空にできません")
      .optional(),
    statusField: z.string().optional(),
    publishedStatuses: z.array(z.string()).optional(),
    accessibleStatuses: z.array(z.string()).optional(),
    hooks: z.unknown().optional(),
  })
  .passthrough()
  .superRefine((v, ctx) => {
    // ページコレクション（kind 既定 "page"）は slugField 必須。要素は不要。
    if (v.kind !== "data" && !v.slugField) {
      ctx.addIssue({
        code: "custom",
        message:
          'ページコレクションの slugField は必須です（URL を持たない場合は kind: "data" を指定）',
        path: ["slugField"],
      });
    }
  });

const cmsAdapterSchema = z
  .object({
    collections: z
      .record(z.string(), collectionDefSchema)
      .refine((v) => Object.keys(v).length > 0, {
        message: "CMSAdapter.collections は少なくとも 1 件必要です",
      }),
  })
  .passthrough();

const createClientOptionsSchema = z
  .object({
    sources: z.record(z.string(), cmsAdapterSchema).optional(),
    cache: z.array(cacheAdapterSchema).optional(),
    swr: z
      .object({
        ttlMs: z.number().int().nonnegative().optional(),
      })
      .optional(),
    renderer: z.function().optional(),
    imageProxyBase: z.string().optional(),
    waitUntil: z.function().optional(),
    hooks: z.unknown().optional(),
    plugins: z.array(z.unknown()).optional(),
    logger: loggerSchema.optional(),
    logLevel: z.enum(["debug", "info", "warn", "error"]).optional(),
    rateLimiter: z
      .object({
        maxConcurrent: z.number().int().positive().optional(),
        retryOn: z.array(z.number().int()).optional(),
        maxRetries: z.number().int().nonnegative().optional(),
        baseDelayMs: z.number().nonnegative().optional(),
      })
      .optional(),
    content: z
      .object({
        remarkPlugins: z.array(z.unknown()).optional(),
        rehypePlugins: z.array(z.unknown()).optional(),
      })
      .optional(),
  })
  .passthrough()
  .superRefine((opts, ctx) => {
    // sources は最低 1 つのアダプタを持つこと
    if (opts.sources) {
      let total = 0;
      for (const adapter of Object.values(opts.sources)) {
        if (adapter)
          total += Object.keys(
            (adapter as { collections: Record<string, unknown> }).collections,
          ).length;
      }
      if (total === 0) {
        ctx.addIssue({
          code: "custom",
          message:
            "createClient.sources にコレクションを含むアダプタを少なくとも 1 つ指定してください",
          path: ["sources"],
        });
      }
    }
  });

const notionPublishOptionsSchema = z.object({
  publishedStatuses: z.array(z.string()).optional(),
  accessibleStatuses: z.array(z.string()).optional(),
});

const schemaEntrySchema = z
  .object({
    kind: z.enum(["page", "data"]).optional(),
    dataSourceId: z.string().min(1, "schema.dataSourceId は必須です"),
    slugField: z
      .string()
      .min(1, "schema.slugField は空にできません")
      .optional(),
    statusField: z.string().optional(),
    properties: z.record(z.string(), z.unknown()),
  })
  .passthrough()
  .superRefine((v, ctx) => {
    if (v.kind !== "data" && !v.slugField) {
      ctx.addIssue({
        code: "custom",
        message: "schema.slugField はページコレクションで必須です",
        path: ["slugField"],
      });
    }
  });

const notionSourceConfigSchema = z
  .object({
    schema: z
      .record(z.string(), schemaEntrySchema)
      .refine((v) => Object.keys(v).length > 0, {
        message: "notionSource.schema は少なくとも 1 件必要です",
      }),
    token: z.string().min(1, "notionSource.token は必須です"),
    fetch: z.unknown().optional(),
    publishOptions: z.record(z.string(), notionPublishOptionsSchema).optional(),
  })
  .passthrough();

const collectionGenConfigSchema = z
  .object({
    kind: z.enum(["page", "data"]).optional(),
    databaseId: z.string().optional(),
    dbName: z.string().optional(),
    slugField: z.string().optional(),
    statusField: z.string().optional(),
    publishedStatuses: z.array(z.string()).optional(),
    accessibleStatuses: z.array(z.string()).optional(),
    fieldMappings: z.record(z.string(), z.string()).optional(),
  })
  .passthrough()
  .refine((v) => v.databaseId != null || v.dbName != null, {
    message:
      "collections[*] には databaseId または dbName のどちらかが必要です",
  });

const cmsConfigSchema = z
  .object({
    output: z.string().min(1, "config.output は必須です"),
    notionToken: z.string().optional(),
    collections: z
      .record(z.string(), collectionGenConfigSchema)
      .refine((v) => Object.keys(v).length > 0, {
        message: "config.collections は少なくとも 1 件必要です",
      }),
  })
  .passthrough();

function formatIssues(issues: readonly z.core.$ZodIssue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

function throwSchemaInvalid(
  operation: string,
  label: string,
  issues: readonly z.core.$ZodIssue[],
): never {
  throw new CMSError({
    code: "core/schema_invalid",
    message: `${label} の検証に失敗しました:\n${formatIssues(issues)}`,
    context: { operation },
    nextSteps: [
      "上記のフィールド名を手がかりに設定値の型と必須性を見直す",
      "TypeScript の型エラーが出ていないか確認する (実行時の値が型から外れている可能性)",
    ],
  });
}

/**
 * `createClient({...})` に渡すオプションを zod で検証する。
 * 検証成功時は入力をそのまま返す。
 *
 * @example
 * import { createClient } from "@notion-headless-cms/core";
 * import { validateCreateClientOptions } from "@notion-headless-cms/validate";
 *
 * const opts = validateCreateClientOptions({ sources: { notion: notionSource(...) } });
 * const cms = createClient(opts);
 */
export function validateCreateClientOptions<T>(opts: T): T {
  const result = createClientOptionsSchema.safeParse(opts);
  if (!result.success) {
    throwSchemaInvalid(
      "validateCreateClientOptions",
      "createClient オプション",
      result.error.issues,
    );
  }
  return opts;
}

/**
 * `notionSource({...})` に渡すオプションを zod で検証する。
 * 検証成功時は入力をそのまま返す。
 */
export function validateNotionSourceConfig<T>(opts: T): T {
  const result = notionSourceConfigSchema.safeParse(opts);
  if (!result.success) {
    throwSchemaInvalid(
      "validateNotionSourceConfig",
      "notionSource オプション",
      result.error.issues,
    );
  }
  return opts;
}

/**
 * `nhc.config.ts` の defineConfig() 戻り値を zod で検証する。
 * 検証成功時は入力をそのまま返す。CLI 内部からも利用される。
 */
export function validateCMSConfig<T>(config: T): T {
  const result = cmsConfigSchema.safeParse(config);
  if (!result.success) {
    throwSchemaInvalid(
      "validateCMSConfig",
      "nhc.config.ts の defineConfig() 戻り値",
      result.error.issues,
    );
  }
  return config;
}
