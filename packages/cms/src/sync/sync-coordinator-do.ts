import type { CMSSyncDelegate } from "../cms/create-cms.js";
import type { SyncStats } from "../query/stats.js";
import type { SyncState } from "./coordinator.js";
import type { DurableObjectStateLike } from "./durable-object-scheduler.js";
import type { DurableObjectStubLike } from "./durable-object-types.js";

/** `SyncCoordinatorDO` が内部で保持すべき最小の CMS 面（`createCMS()` の戻り値の一部）。 */
export interface SyncCoordinatorCMS {
  readonly sync: {
    kick(): Promise<void>;
    onWebhook(): Promise<void>;
    reconcile(): Promise<{ removed: readonly string[] }>;
    getState(): Promise<SyncState>;
    stats(): Promise<SyncStats>;
  };
}

export interface SyncCoordinatorDOOptions<Env = unknown> {
  /**
   * DO の constructor 内で `createCMS()` を呼び出すためのファクトリ。
   * `scheduler: createDurableObjectSyncScheduler(state)` を渡すこと
   * （DO state は DO 内からしか取得できないため、この呼び出しは DO の外では行えない）。
   */
  createCMS(state: DurableObjectStateLike, env: Env): SyncCoordinatorCMS;
}

/** `createSyncCoordinatorDO` が返す DO クラスの公開面（wrangler.toml から binding される形）。 */
export interface SyncCoordinatorDOInstance {
  fetch(request: Request): Promise<Response>;
  alarm(): Promise<void>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Notion アクセスを直列化する同期エンジンを Durable Object として export するためのファクトリ
 * (#441/#443)。DO インスタンスは alarm 発火の間にエビクトされ得るため、`alarm()` は
 * `options.createCMS` を都度呼び直して CMS（と内部の SyncCoordinatorCore）を再構築する
 * （`durable-object-scheduler.ts` の設計コメント参照）。
 *
 * 生成された DO クラスは内部エンドポイント（`POST /kick` `POST /webhook` `POST /reconcile`
 * `GET /state` `GET /stats`）を持つ。読者用の stateless Worker からは
 * `durableObjectSyncDelegate(stub)` 経由で `createCMS({ syncDelegate })` に渡して使う
 * （読者リクエストの処理中に Notion API を呼ばないという v3 の北極星を保つため、
 * 読み取りは KV/R2 から直接行い、DO には sync 制御のみを委ねる設計）。
 *
 * @example
 * // wrangler.toml で binding する DO クラス（Worker から re-export する）
 * export const SyncCoordinatorDO = createSyncCoordinatorDO({
 *   createCMS: (state, env) =>
 *     createCMS({
 *       schema,
 *       notion: { token: env.NOTION_TOKEN },
 *       stores: { docs: kvDocStore(env.DOC_INDEX), blobs: r2BlobStore(env.ENTRY_BUCKET) },
 *       scheduler: createDurableObjectSyncScheduler(state),
 *     }),
 * });
 */
export function createSyncCoordinatorDO<Env = unknown>(
  options: SyncCoordinatorDOOptions<Env>,
): new (
  state: DurableObjectStateLike,
  env: Env,
) => SyncCoordinatorDOInstance {
  // 戻り値に明示の型注釈（上）を付けることで、tsdown の isolated declarations 生成が
  // 無名クラスの構造（private field 含む）を .d.ts に展開しようとして TS4094 で
  // 失敗するのを避ける（宣言はこの注釈だけを見ればよくなる）。
  return class SyncCoordinatorDO implements SyncCoordinatorDOInstance {
    #cms: SyncCoordinatorCMS;

    constructor(state: DurableObjectStateLike, env: Env) {
      this.#cms = options.createCMS(state, env);
    }

    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      try {
        if (request.method === "POST" && url.pathname === "/kick") {
          await this.#cms.sync.kick();
          return jsonResponse({ ok: true });
        }
        if (request.method === "POST" && url.pathname === "/webhook") {
          await this.#cms.sync.onWebhook();
          return jsonResponse({ ok: true });
        }
        if (request.method === "POST" && url.pathname === "/reconcile") {
          const result = await this.#cms.sync.reconcile();
          return jsonResponse({ ok: true, removed: result.removed });
        }
        if (request.method === "GET" && url.pathname === "/state") {
          const state = await this.#cms.sync.getState();
          return jsonResponse({ ok: true, state });
        }
        if (request.method === "GET" && url.pathname === "/stats") {
          const stats = await this.#cms.sync.stats();
          return jsonResponse({ ok: true, stats });
        }
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500,
        );
      }
      return new Response("Not Found", { status: 404 });
    }

    /** Alarm 発火ごとに CMS を再構築して kick する(インスタンスがエビクトされていても続行できる)。 */
    async alarm(): Promise<void> {
      await this.#cms.sync.kick();
    }
  };
}

export interface DurableObjectSyncDelegateOptions {
  readonly stub: DurableObjectStubLike;
  /** DO 内部エンドポイントのベース URL。`stub.fetch` は経路のみ見るため任意の値でよい。 */
  readonly baseUrl?: string;
}

/**
 * stateless Worker 側の `createCMS({ syncDelegate })` に渡す、DO stub への転送実装。
 * `createSyncCoordinatorDO` が作る DO クラスと対になる。
 */
export function durableObjectSyncDelegate(
  opts: DurableObjectSyncDelegateOptions,
): CMSSyncDelegate {
  const base = opts.baseUrl ?? "https://sync-coordinator";
  const { stub } = opts;
  return {
    async kick() {
      await stub.fetch(`${base}/kick`, { method: "POST" });
    },
    async onWebhook() {
      await stub.fetch(`${base}/webhook`, { method: "POST" });
    },
    async reconcile() {
      const res = await stub.fetch(`${base}/reconcile`, { method: "POST" });
      const body = (await res.json()) as { removed?: readonly string[] };
      return { removed: body.removed ?? [] };
    },
    async getState() {
      const res = await stub.fetch(`${base}/state`);
      const body = (await res.json()) as { state?: SyncState | null };
      return body.state ?? null;
    },
    async stats() {
      const res = await stub.fetch(`${base}/stats`);
      const body = (await res.json()) as { stats: SyncStats };
      return body.stats;
    },
  };
}
