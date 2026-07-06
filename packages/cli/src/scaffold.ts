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

/**
 * `nhc init` が生成するマウントコード雛形(#446)。`examples/cloudflare-hono` の
 * 実働構成(`src/lib/do.ts` + `src/lib/cms.ts` + `src/index.ts`)と同じ配線を
 * `generateWranglerToml` の binding 名で再現する。相対パス → ファイル内容のマップを返す。
 */
export function generateMountCodeTemplate(
  opts: InitScaffoldOptions,
): Record<string, string> {
  const kv = opts.kvBinding ?? "DOC_INDEX";
  const r2 = opts.r2Binding ?? "ENTRY_BUCKET";
  const doClass = opts.doClassName ?? "SyncCoordinatorDO";
  const doBinding = opts.doBindingName ?? "SYNC_COORDINATOR";

  const doFile = `import type { DurableObjectStateLike } from "@notion-headless-cms/cms";
import {
  createCMS,
  createDurableObjectSyncScheduler,
} from "@notion-headless-cms/cms";
import {
  createSyncCoordinatorDO,
  kvDocStore,
  r2BlobStore,
} from "@notion-headless-cms/cms/cloudflare";
import { schema } from "../schema.js";
import type { Env } from "./cms.js";

/**
 * Notion アクセスを直列化する Durable Object。wrangler.toml の
 * durable_objects.bindings で "${doClass}" として binding する
 * (src/index.ts から re-export し、Worker のエントリに含める必要がある)。
 *
 * DO インスタンスは alarm 発火の間にエビクトされ得るため、createCMS は
 * DO の constructor で毎回呼び直す設計(createSyncCoordinatorDO 参照)。
 */
export const ${doClass} = createSyncCoordinatorDO<Env>({
  createCMS: (state: DurableObjectStateLike, env: Env) =>
    createCMS({
      schema,
      notion: { token: env.NOTION_TOKEN },
      stores: {
        docs: kvDocStore(env.${kv}),
        blobs: r2BlobStore(env.${r2}),
      },
      scheduler: createDurableObjectSyncScheduler(state),
    }),
});
`;

  const cmsFile = `import { createCMS } from "@notion-headless-cms/cms";
import {
  durableObjectSyncDelegate,
  kvDocStore,
  r2BlobStore,
} from "@notion-headless-cms/cms/cloudflare";
import { schema } from "../schema.js";

export interface Env {
  readonly NOTION_TOKEN: string;
  readonly ${kv}: KVNamespace;
  readonly ${r2}: R2Bucket;
  readonly ${doBinding}: DurableObjectNamespace;
}

/**
 * 読者用の stateless Worker 側インスタンス。KV/R2 の読み取り(find/list)は
 * ここで直接行い、Notion API への直列アクセスは ${doClass}(src/lib/do.ts)に
 * 一元化する(syncDelegate 経由で転送する)。
 */
export function makeCms(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
) {
  const id = env.${doBinding}.idFromName("global");
  const stub = env.${doBinding}.get(id);
  return createCMS({
    schema,
    stores: {
      docs: kvDocStore(env.${kv}),
      blobs: r2BlobStore(env.${r2}),
    },
    syncDelegate: durableObjectSyncDelegate({ stub }),
    waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p),
  });
}
`;

  const indexFile = `import { Hono } from "hono";
import { type Env, makeCms } from "./lib/cms.js";

export { ${doClass} } from "./lib/do.js";

const app = new Hono<{ Bindings: Env }>();

// 手動 kick 用のメンテナンスエンドポイント(初回コールドスタート時や動作確認用)。
// 本来は Notion webhook(/api/cms/webhook 経由)が ${doClass} を起動する。
app.post("/api/sync/kick", (c) => {
  const cms = makeCms(c.env, c.executionCtx);
  c.executionCtx.waitUntil(cms.sync.kick());
  return c.json({ ok: true });
});

// 画像プロキシ・webhook・OGP を cms.fetch() 1 つにまとめて配信する。
app.all("/api/cms/*", (c) => makeCms(c.env, c.executionCtx).fetch(c.req.raw));

export default {
  fetch: app.fetch,
  scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(makeCms(env, ctx).scheduled());
  },
};
`;

  return {
    "src/lib/do.ts": doFile,
    "src/lib/cms.ts": cmsFile,
    "src/index.ts": indexFile,
  };
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
