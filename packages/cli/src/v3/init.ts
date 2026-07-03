export interface InitScaffoldOptions {
  readonly projectName: string;
  readonly kvBinding?: string;
  readonly r2Binding?: string;
  readonly doClassName?: string;
  readonly doBindingName?: string;
}

/**
 * `nhc init` の wrangler 設定雛形(KV / R2 / DO binding・`new_sqlite_classes`・cron)。
 */
export function generateWranglerToml(opts: InitScaffoldOptions): string {
  const kv = opts.kvBinding ?? "DOC_INDEX";
  const r2 = opts.r2Binding ?? "ENTRY_BUCKET";
  const doClass = opts.doClassName ?? "SyncCoordinatorDO";
  const doBinding = opts.doBindingName ?? "SYNC_COORDINATOR";

  return `name = "${opts.projectName}"
main = "src/index.ts"
compatibility_date = "2026-01-01"

kv_namespaces = [
  { binding = "${kv}", id = "REPLACE_WITH_KV_NAMESPACE_ID" }
]

r2_buckets = [
  { binding = "${r2}", bucket_name = "REPLACE_WITH_R2_BUCKET_NAME" }
]

[[durable_objects.bindings]]
name = "${doBinding}"
class_name = "${doClass}"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["${doClass}"]

[triggers]
crons = ["0 * * * *"]
`;
}

/** `nhc init` が生成する最小マウントコードの雛形(利用側が binding 名を差し替えて使う)。 */
export function generateMountCodeTemplate(): string {
  return `import { createFetchHandler, createScheduledHandler } from "@notion-headless-cms/cms";
// TODO: SyncCoordinatorDO の具体的な結線(binding からのインスタンス取得・
// coordinator 構築)はプロジェクトの wrangler.toml 設定に合わせて実装してください。

export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    // TODO: env から KV/R2/DO binding を取り出し、HttpHandlerAdapter を構築する
    throw new Error("not implemented: wire up HttpHandlerAdapter from env bindings");
  },
  scheduled(event: unknown, env: unknown, ctx: ExecutionContext) {
    // TODO: env から SyncCoordinatorCore を構築する
    throw new Error("not implemented: wire up SyncCoordinatorCore from env bindings");
  },
};
`;
}

/** `nhc init` が生成する最小スキーマ雛形。 */
export function generateSchemaTemplate(): string {
  return `import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";

const posts = defineCollection({
  dataSourceId: "REPLACE_WITH_DATA_SOURCE_ID",
  slug: "slug",
  properties: {
    title: prop.title(),
    slug: prop.richText(),
    status: prop.status(["draft", "published"] as const),
  },
  statusProperty: "status",
  published: ["published"],
});

export const schema = defineSchema({ posts });
`;
}
