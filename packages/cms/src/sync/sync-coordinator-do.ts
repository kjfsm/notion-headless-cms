import type { CMSSyncDelegate } from "../cms/create-cms.js";
import { CMSError } from "../errors.js";
import type { SyncStats } from "../query/stats.js";
import type { SyncState } from "./coordinator.js";
import type { DurableObjectStateLike } from "./durable-object-scheduler.js";
import type { DurableObjectNamespaceLike, DurableObjectStubLike } from "./durable-object-types.js";

/** `SyncCoordinatorDO` が内部で保持すべき最小の CMS 面（`createCMS()` の戻り値の一部）。 */
export interface SyncCoordinatorCMS {
  readonly sync: {
    kick: () => Promise<void>;
    onWebhook: () => Promise<void>;
    reconcile: () => Promise<{ removed: readonly string[] }>;
    getState: () => Promise<SyncState>;
    stats: () => Promise<SyncStats>;
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
 * (#441/#443)。DO インスタンスは alarm 発火の間にエビクトされ得るが、`options.createCMS`
 * (と内部の `SyncCoordinatorCore`)の再構築は `alarm()` 自体ではなくコンストラクタで
 * 行う。エビクト後に DO ランタイムが新しいインスタンスを起こす際は必ずコンストラクタが
 * 呼ばれるため、結果として再構築される（`durable-object-scheduler.ts` の設計コメント参照）。
 * `alarm()` はその時点で保持している `#cms` を使って `kick()` を呼ぶだけ。
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
 *       stores: { index: d1IndexStore(env.DB, schema), blobs: r2BlobStore(env.ENTRY_BUCKET) },
 *       scheduler: createDurableObjectSyncScheduler(state),
 *     }),
 * });
 */
export function createSyncCoordinatorDO<Env = unknown>(
  options: SyncCoordinatorDOOptions<Env>,
): new (state: DurableObjectStateLike, env: Env) => SyncCoordinatorDOInstance {
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

    /**
     * コンストラクタで構築済みの `#cms` を使って kick するだけ(CMS の再構築はしない)。
     * エビクト後に DO ランタイムが新しいインスタンスを起こした場合は、その時点の
     * コンストラクタ呼び出しで既に再構築が済んでいるため、続行できる。
     */
    async alarm(): Promise<void> {
      await this.#cms.sync.kick();
    }
  };
}

export interface DurableObjectSyncDelegateStubOptions {
  readonly stub: DurableObjectStubLike;
  /** DO 内部エンドポイントのベース URL。`stub.fetch` は経路のみ見るため任意の値でよい。 */
  readonly baseUrl?: string;
}

export interface DurableObjectSyncDelegateNamespaceOptions {
  /** SyncCoordinatorDO の namespace binding（`env.SYNC_COORDINATOR` 等）。 */
  readonly namespace: DurableObjectNamespaceLike;
  /**
   * DO インスタンス名（`idFromName`）。既定 `"global"`。
   * Notion アクセスを単一インスタンスへ集約するため、通常は既定のままにする。
   */
  readonly name?: string;
  readonly baseUrl?: string;
}

/**
 * `durableObjectSyncDelegate` の引数。`stub` を直接渡す形と、`namespace`（+任意 `name`）を渡して
 * 内部で `idFromName` から stub を解決する形の両方を受け付ける。
 */
export type DurableObjectSyncDelegateOptions =
  | DurableObjectSyncDelegateStubOptions
  | DurableObjectSyncDelegateNamespaceOptions;

function resolveDelegateStub(opts: DurableObjectSyncDelegateOptions): DurableObjectStubLike {
  if ("stub" in opts) return opts.stub;
  return opts.namespace.get(opts.namespace.idFromName(opts.name ?? "global"));
}

/**
 * stateless Worker 側の `createCMS({ syncDelegate })` に渡す、DO stub への転送実装。
 * `createSyncCoordinatorDO` が作る DO クラスと対になる。
 *
 * @example
 * // namespace を渡すと idFromName("global") から stub を解決する
 * durableObjectSyncDelegate({ namespace: env.SYNC_COORDINATOR });
 * // 既存どおり stub を直接渡すことも可能
 * durableObjectSyncDelegate({ stub: ns.get(ns.idFromName("global")) });
 */
/**
 * DO からのレスポンスが非 OK なら、`fetch()`(`sync-coordinator-do.ts` の
 * `SyncCoordinatorDO#fetch`)が返した `{ ok: false, error }` ボディのメッセージを
 * 使って `CMSError` を投げる。ここでステータスを見ずに `res.json()` の中身だけ
 * 使うと、DO 側が 500 を返していても呼び出し元が成功と誤認してしまう。
 */
async function assertOk(res: Response, operation: string): Promise<void> {
  if (res.ok) return;
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // JSON でないボディはそのまま status/statusText を使う。
  }
  throw new CMSError({
    code: "sync/durable_object_request_failed",
    message: `SyncCoordinatorDO へのリクエストに失敗しました: ${message}`,
    context: { operation },
  });
}

export function durableObjectSyncDelegate(opts: DurableObjectSyncDelegateOptions): CMSSyncDelegate {
  const base = opts.baseUrl ?? "https://sync-coordinator";
  const stub = resolveDelegateStub(opts);
  return {
    async kick() {
      const res = await stub.fetch(`${base}/kick`, { method: "POST" });
      await assertOk(res, "kick");
    },
    async onWebhook() {
      const res = await stub.fetch(`${base}/webhook`, { method: "POST" });
      await assertOk(res, "onWebhook");
    },
    async reconcile() {
      const res = await stub.fetch(`${base}/reconcile`, { method: "POST" });
      await assertOk(res, "reconcile");
      const body = (await res.json()) as { removed?: readonly string[] };
      return { removed: body.removed ?? [] };
    },
    async getState() {
      const res = await stub.fetch(`${base}/state`);
      await assertOk(res, "getState");
      const body = (await res.json()) as { state?: SyncState | null };
      return body.state ?? null;
    },
    async stats() {
      const res = await stub.fetch(`${base}/stats`);
      await assertOk(res, "stats");
      const body = (await res.json()) as { stats: SyncStats };
      return body.stats;
    },
  };
}

/**
 * 同期を一切行わない読み取り専用の `CMSSyncDelegate`。
 * DO を持たないプレビュー/読者専用 Worker が、本番 DO の同期済み KV/R2 を読むだけの構成で使う
 * （同期の書き込み直列化を迂回させないため、こちらからは Notion へ一切アクセスしない）。
 *
 * @example
 * createCMS({ schema, stores, syncDelegate: readerReadOnly() });
 */
export function readerReadOnly(): CMSSyncDelegate {
  return {
    async kick() {},
    async onWebhook() {},
    async reconcile() {
      return { removed: [] };
    },
    async getState() {
      return null;
    },
    async stats() {
      return {
        lastSyncAt: null,
        lastReconcileAt: null,
        failureCount: 0,
        recentFailures: [],
        writeBudget: null,
      };
    },
  };
}
