import { useEffect } from "react";
import useSWR from "swr";
import useSWRSubscription from "swr/subscription";

/**
 * 再検証のトリガー。
 * - "mount": ハイドレーション直後に 1 度だけ実行
 * - "visibility": タブ可視化 (`visibilitychange` で hidden→visible) の度に実行
 */
export type NotionRevalidateTrigger = "mount" | "visibility";

/**
 * KV ポーリングのオプション（push が無い環境のフォールバック）。
 *
 * `url` は省略でき、その場合 `collection` と `slug`（または `item.slug`）から
 * `cms.handler()` の versions ルート URL を導出する。
 */
export interface NotionPollOptions {
  /**
   * peekVersion を返すエンドポイント URL。省略時は `collection` / `slug`（または `item`）
   * から `${basePath}/versions/${collection}/${slug}` を導出する。
   */
  url?: string;
  /** URL 導出に使うコレクション名（例: "posts"）。`url` 省略時に必須。 */
  collection?: string;
  /** URL 導出に使う slug。省略時は `item.slug` を使う。 */
  slug?: string;
  /** `slug` と `version` をまとめて導出するためのアイテム。 */
  item?: { slug: string; lastEditedTime: string };
  /** URL 導出時のベースパス。既定 `/api/cms`（`cms.handler()` の既定 basePath）。 */
  basePath?: string;
  /** ポーリング比較基準のバージョン。省略時は `item.lastEditedTime` を使う。 */
  version?: string;
  /** ポーリング間隔（ms）。既定: 5000 */
  intervalMs?: number;
  /** タイムアウト（ms）。互換のため受け取るが vercel/swr 方式では未使用。 */
  timeoutMs?: number;
}

/**
 * リアルタイム購読（push）のオプション。設定すると WebSocket でサーバ push を受け、
 * メッセージ受信で即 revalidate する。`url`（ws/wss）を明示するか、`collection` /
 * `slug`（または `item`）から `${basePath}${path}?collection=&slug=` を導出する。
 */
export interface NotionRealtimeOptions {
  /** 接続先 WebSocket URL（ws/wss）。明示時は導出より優先。 */
  url?: string;
  /** URL 導出に使うコレクション名。`url` 省略時に必須。 */
  collection?: string;
  /** URL 導出に使う slug。省略時は `item.slug`。 */
  slug?: string;
  /** `slug` を導出するためのアイテム。 */
  item?: { slug: string };
  /** URL 導出時のベースパス。既定 `/api/cms`。 */
  basePath?: string;
  /** realtime ルートのパス。既定 `/realtime`。 */
  path?: string;
}

/** `cms.handler()` の既定 basePath。poll / realtime URL 導出のデフォルト。 */
const DEFAULT_CMS_BASE_PATH = "/api/cms";
const DEFAULT_REALTIME_PATH = "/realtime";
const DEFAULT_POLL_INTERVAL_MS = 5000;

/**
 * poll オプションから実際に叩く URL と比較バージョンを解決する。
 * どちらでも解決できなければ null（= ポーリングしない）。
 */
export function resolvePoll(poll: NotionPollOptions | undefined): {
  url: string;
  version: string;
  intervalMs?: number;
  timeoutMs?: number;
} | null {
  if (!poll) return null;
  const slug = poll.slug ?? poll.item?.slug;
  const version = poll.version ?? poll.item?.lastEditedTime;
  const basePath = poll.basePath ?? DEFAULT_CMS_BASE_PATH;
  const url =
    poll.url ??
    (poll.collection && slug
      ? `${basePath}/versions/${poll.collection}/${slug}`
      : undefined);
  if (!url || version === undefined) return null;
  return {
    url,
    version,
    intervalMs: poll.intervalMs,
    timeoutMs: poll.timeoutMs,
  };
}

/**
 * realtime オプションから接続先を解決する。
 * 明示 `url` はそのまま、導出時は origin 非依存の相対 `path` を返す
 * （ws/wss スキームの組み立ては呼び出し側で `window.location` を使って行う）。
 */
export function resolveRealtime(
  realtime: NotionRealtimeOptions | undefined,
): { url: string } | { path: string } | null {
  if (!realtime) return null;
  if (realtime.url) return { url: realtime.url };
  if (!realtime.collection) return null;
  const slug = realtime.slug ?? realtime.item?.slug;
  const basePath = realtime.basePath ?? DEFAULT_CMS_BASE_PATH;
  const path = realtime.path ?? DEFAULT_REALTIME_PATH;
  const qs = new URLSearchParams({ collection: realtime.collection });
  if (slug) qs.set("slug", slug);
  return { path: `${basePath}${path}?${qs.toString()}` };
}

/** 解決済み realtime descriptor を実際の ws/wss URL へ変換する。 */
export function wsUrlFromResolved(
  resolved: { url: string } | { path: string },
  locationHref: string,
): string {
  if ("url" in resolved) return resolved.url;
  const u = new URL(resolved.path, locationHref);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return u.toString();
}

export interface UseNotionRevalidateOptions {
  /** 既定値: "mount"。複数指定可。`poll` / `realtime` 指定時はトリガーなしがデフォルト。 */
  on?: NotionRevalidateTrigger | NotionRevalidateTrigger[];
  /** KV ポーリング（push 無し環境のフォールバック）。 */
  poll?: NotionPollOptions;
  /** リアルタイム購読（push 主経路）。 */
  realtime?: NotionRealtimeOptions;
}

/** `on` を正規化。未指定時は watcher（poll/realtime）があれば `[]`、なければ `["mount"]`。 */
const toTriggerList = (
  on: NotionRevalidateTrigger | NotionRevalidateTrigger[] | undefined,
  hasWatcher: boolean,
): NotionRevalidateTrigger[] => {
  if (on !== undefined) return Array.isArray(on) ? on : [on];
  return hasWatcher ? [] : ["mount"];
};

interface PeekVersion {
  notionUpdatedAt: string;
  cachedAt: number;
}

const versionFetcher = async (url: string): Promise<PeekVersion | null> => {
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as PeekVersion | null;
};

/**
 * フレームワーク差分を吸収するための関数 hook。
 * `revalidate` には「現ルートを再評価する」関数を渡す:
 *   - React Router: `() => useRevalidator().revalidate()`
 *   - Next.js: `() => useRouter().refresh()`
 *
 * 更新検知は 2 経路:
 *   - realtime（push 主経路）: `useSWRSubscription` で WebSocket を購読し、メッセージで即 revalidate。
 *   - poll（フォールバック）: `useSWR` の `refreshInterval` で versions を取得し、
 *     `notionUpdatedAt` がローダ既知 version と変われば revalidate。focus/reconnect でも再検証する。
 */
export function useRevalidateEffect(
  revalidate: () => void,
  opts: UseNotionRevalidateOptions,
): void {
  const resolvedRealtime = resolveRealtime(opts.realtime);
  const resolvedPoll = resolvePoll(opts.poll);
  const hasWatcher = Boolean(resolvedRealtime || resolvedPoll);
  const triggerKey = toTriggerList(opts.on, hasWatcher).join(",");

  const pollUrl = resolvedPoll?.url ?? null;
  const pollVersion = resolvedPoll?.version;
  const pollIntervalMs = resolvedPoll?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  // realtime は SSR/初回レンダーでも安定値が要るため、location 依存の組み立ては
  // 文字列キーに落としてから渡す（毎レンダー別オブジェクトになるのを防ぐ）。
  const wsUrl =
    resolvedRealtime && typeof window !== "undefined"
      ? wsUrlFromResolved(resolvedRealtime, window.location.href)
      : null;

  useEffect(() => {
    const triggers = triggerKey
      .split(",")
      .filter((t): t is NotionRevalidateTrigger => t.length > 0);
    if (triggers.includes("mount")) revalidate();
    if (triggers.includes("visibility")) {
      const handler = () => {
        if (document.visibilityState === "visible") revalidate();
      };
      document.addEventListener("visibilitychange", handler);
      return () => document.removeEventListener("visibilitychange", handler);
    }
  }, [revalidate, triggerKey]);

  // push 主経路: WebSocket を購読し、更新通知メッセージで即 revalidate する。
  useSWRSubscription(wsUrl, (key, { next }) => {
    const ws = new WebSocket(key);
    ws.addEventListener("message", () => revalidate());
    ws.addEventListener("error", (event) => next(event));
    return () => ws.close();
  });

  // フォールバック: versions をポーリングし、version が変われば revalidate する。
  const { data } = useSWR<PeekVersion | null>(pollUrl, versionFetcher, {
    refreshInterval: pollIntervalMs,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });
  useEffect(() => {
    if (
      data &&
      pollVersion !== undefined &&
      data.notionUpdatedAt !== pollVersion
    ) {
      revalidate();
    }
  }, [data, pollVersion, revalidate]);
}
