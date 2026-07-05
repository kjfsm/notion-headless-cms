import { describe, expect, it, vi } from "vitest";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStubLike,
} from "../durable-object-types.js";
import type { SyncCoordinatorCMS } from "../sync-coordinator-do.js";
import {
  createSyncCoordinatorDO,
  durableObjectSyncDelegate,
  readerReadOnly,
} from "../sync-coordinator-do.js";

function makeFakeCMS(
  overrides: Partial<SyncCoordinatorCMS["sync"]> = {},
): SyncCoordinatorCMS {
  return {
    sync: {
      kick: vi.fn().mockResolvedValue(undefined),
      onWebhook: vi.fn().mockResolvedValue(undefined),
      reconcile: vi.fn().mockResolvedValue({ removed: [] }),
      getState: vi.fn().mockResolvedValue({
        cursor: null,
        lastSyncAt: null,
        lastReconcileAt: null,
        failures: [],
      }),
      stats: vi.fn().mockResolvedValue({
        lastSyncAt: null,
        lastReconcileAt: null,
        failureCount: 0,
        recentFailures: [],
      }),
      ...overrides,
    },
  };
}

describe("createSyncCoordinatorDO", () => {
  it("POST /kick は sync.kick を呼ぶ", async () => {
    const cms = makeFakeCMS();
    const DO = createSyncCoordinatorDO({ createCMS: () => cms });
    const instance = new DO({} as never, {});
    const res = await instance.fetch(
      new Request("https://do/kick", { method: "POST" }),
    );
    expect(cms.sync.kick).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("POST /webhook は sync.onWebhook を呼ぶ", async () => {
    const cms = makeFakeCMS();
    const DO = createSyncCoordinatorDO({ createCMS: () => cms });
    const instance = new DO({} as never, {});
    await instance.fetch(new Request("https://do/webhook", { method: "POST" }));
    expect(cms.sync.onWebhook).toHaveBeenCalledTimes(1);
  });

  it("POST /reconcile は removed を返す", async () => {
    const cms = makeFakeCMS({
      reconcile: vi.fn().mockResolvedValue({ removed: ["a", "b"] }),
    });
    const DO = createSyncCoordinatorDO({ createCMS: () => cms });
    const instance = new DO({} as never, {});
    const res = await instance.fetch(
      new Request("https://do/reconcile", { method: "POST" }),
    );
    expect(await res.json()).toEqual({ ok: true, removed: ["a", "b"] });
  });

  it("GET /state は sync.getState の結果を返す", async () => {
    const cms = makeFakeCMS({
      getState: vi.fn().mockResolvedValue({
        cursor: "c1",
        lastSyncAt: "v1",
        lastReconcileAt: null,
        failures: [],
      }),
    });
    const DO = createSyncCoordinatorDO({ createCMS: () => cms });
    const instance = new DO({} as never, {});
    const res = await instance.fetch(new Request("https://do/state"));
    const body = (await res.json()) as { state: { cursor: string } };
    expect(body.state.cursor).toBe("c1");
  });

  it("GET /stats は sync.stats の結果を返す", async () => {
    const cms = makeFakeCMS();
    const DO = createSyncCoordinatorDO({ createCMS: () => cms });
    const instance = new DO({} as never, {});
    const res = await instance.fetch(new Request("https://do/stats"));
    expect(res.status).toBe(200);
  });

  it("不明なパスは 404", async () => {
    const cms = makeFakeCMS();
    const DO = createSyncCoordinatorDO({ createCMS: () => cms });
    const instance = new DO({} as never, {});
    const res = await instance.fetch(new Request("https://do/unknown"));
    expect(res.status).toBe(404);
  });

  it("同期失敗時は 500 とエラーメッセージを返す(fail-soft)", async () => {
    const cms = makeFakeCMS({
      kick: vi.fn().mockRejectedValue(new Error("notion down")),
    });
    const DO = createSyncCoordinatorDO({ createCMS: () => cms });
    const instance = new DO({} as never, {});
    const res = await instance.fetch(
      new Request("https://do/kick", { method: "POST" }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "notion down" });
  });

  it("alarm() は sync.kick を呼ぶ(DO エビクト後の再構築を想定し createCMS を都度呼ぶ)", async () => {
    const cms = makeFakeCMS();
    const createCMSFn = vi.fn().mockReturnValue(cms);
    const DO = createSyncCoordinatorDO({ createCMS: createCMSFn });
    const instance = new DO({} as never, {});
    expect(createCMSFn).toHaveBeenCalledTimes(1);
    await instance.alarm();
    expect(cms.sync.kick).toHaveBeenCalledTimes(1);
  });
});

describe("durableObjectSyncDelegate", () => {
  function makeStub(
    handler: (url: string, init?: RequestInit) => Promise<Response>,
  ): DurableObjectStubLike {
    return { fetch: vi.fn(handler) };
  }

  it("kick/onWebhook は対応する内部パスへ POST する", async () => {
    const calls: string[] = [];
    const stub = makeStub(async (url) => {
      calls.push(url);
      return new Response(JSON.stringify({ ok: true }));
    });
    const delegate = durableObjectSyncDelegate({ stub });
    await delegate.kick();
    await delegate.onWebhook();
    expect(calls).toEqual([
      "https://sync-coordinator/kick",
      "https://sync-coordinator/webhook",
    ]);
  });

  it("reconcile は removed を DO のレスポンスから取り出す", async () => {
    const stub = makeStub(
      async () => new Response(JSON.stringify({ ok: true, removed: ["x"] })),
    );
    const delegate = durableObjectSyncDelegate({ stub });
    expect(await delegate.reconcile()).toEqual({ removed: ["x"] });
  });

  it("getState は DO のレスポンスから state を取り出す(未設定時は null)", async () => {
    const stub = makeStub(
      async () => new Response(JSON.stringify({ ok: true, state: null })),
    );
    const delegate = durableObjectSyncDelegate({ stub });
    expect(await delegate.getState()).toBeNull();
  });

  it("stats は DO のレスポンスから stats を取り出す", async () => {
    const stats = {
      lastSyncAt: "v1",
      lastReconcileAt: null,
      failureCount: 0,
      recentFailures: [],
    };
    const stub = makeStub(
      async () => new Response(JSON.stringify({ ok: true, stats })),
    );
    const delegate = durableObjectSyncDelegate({ stub });
    expect(await delegate.stats()).toEqual(stats);
  });

  function makeNamespace(stub: DurableObjectStubLike) {
    const idFromName = vi.fn((name: string) => ({ name }));
    const get = vi.fn(() => stub);
    const namespace: DurableObjectNamespaceLike = { idFromName, get };
    return { namespace, idFromName, get };
  }

  it("namespace 指定時は idFromName('global') から stub を解決して転送する", async () => {
    const calls: string[] = [];
    const stub = makeStub(async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ ok: true }));
    });
    const { namespace, idFromName, get } = makeNamespace(stub);
    const delegate = durableObjectSyncDelegate({ namespace });
    await delegate.kick();
    expect(idFromName).toHaveBeenCalledWith("global");
    expect(get).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["https://sync-coordinator/kick"]);
  });

  it("namespace + name 指定時はその name を idFromName に渡す", async () => {
    const stub = makeStub(
      async () => new Response(JSON.stringify({ ok: true })),
    );
    const { namespace, idFromName } = makeNamespace(stub);
    const delegate = durableObjectSyncDelegate({ namespace, name: "tenant-a" });
    await delegate.onWebhook();
    expect(idFromName).toHaveBeenCalledWith("tenant-a");
  });
});

describe("readerReadOnly", () => {
  it("全メソッドが no-op（Notion へ同期しない）", async () => {
    const delegate = readerReadOnly();
    await expect(delegate.kick()).resolves.toBeUndefined();
    await expect(delegate.onWebhook()).resolves.toBeUndefined();
    expect(await delegate.reconcile()).toEqual({ removed: [] });
    expect(await delegate.getState()).toBeNull();
    expect(await delegate.stats()).toEqual({
      lastSyncAt: null,
      lastReconcileAt: null,
      failureCount: 0,
      recentFailures: [],
    });
  });
});
