import { useEffect } from "react";
import useSWRSubscription from "swr/subscription";

/**
 * 再検証のトリガー。
 * - "mount": ハイドレーション直後に 1 度だけ実行
 * - "visibility": タブ可視化 (`visibilitychange` で hidden→visible) の度に実行
 */
export type NotionRevalidateTrigger = "mount" | "visibility";

/**
 * 鮮度チェックのオプション（DO/realtime が無い環境のフォールバック）。
 *
 * mount / 再フォーカス時に `POST {basePath}/check/{collection}/{slug}?v=` を叩き、
 * サーバーが Notion と突合した結果 `stale: true` のときだけ revalidate する。
 * `url` は省略でき、その場合 `collection` と `slug`（または `item.slug`）から導出する。
 * realtime（DO）を併用する場合、このチェックは行わない（push が主経路）。
 */
export interface NotionPollOptions {
  /**
   * check エンドポイント URL。省略時は `collection` / `slug`（または `item`）
   * から `${basePath}/check/${collection}/${slug}` を導出する。
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
  /** チェック時にサーバーへ送る現在の表示バージョン。省略時は `item.lastEditedTime` を使う。 */
  version?: string;
  /**
   * 間隔チェック（ms）。既定は未設定＝間隔チェックなし（mount / 再フォーカス契機のみ）。
   * 明示すると従来どおり一定間隔でも check する（Notion API を消費するので注意）。
   */
  intervalMs?: number;
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

/** `cms.handler()` の既定 basePath。check / realtime URL 導出のデフォルト。 */
const DEFAULT_CMS_BASE_PATH = "/api/cms";
const DEFAULT_REALTIME_PATH = "/realtime";

/**
 * poll（check）オプションから実際に叩く check URL と送信バージョンを解決する。
 * どちらでも解決できなければ null（= チェックしない）。
 */
export function resolvePoll(poll: NotionPollOptions | undefined): {
  url: string;
  version: string;
  intervalMs?: number;
} | null {
  if (!poll) return null;
  const slug = poll.slug ?? poll.item?.slug;
  const version = poll.version ?? poll.item?.lastEditedTime;
  const basePath = poll.basePath ?? DEFAULT_CMS_BASE_PATH;
  const url =
    poll.url ??
    (poll.collection && slug ? `${basePath}/check/${poll.collection}/${slug}` : undefined);
  if (!url || version === undefined) return null;
  return {
    url,
    version,
    intervalMs: poll.intervalMs,
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
  /** 既定値: `["mount", "visibility"]`（開いた時＋再フォーカス）。複数指定可。 */
  on?: NotionRevalidateTrigger | NotionRevalidateTrigger[];
  /** 鮮度チェック（DO/realtime 無効時のフォールバック。`POST /check`）。 */
  poll?: NotionPollOptions;
  /** リアルタイム購読（DO, push 主経路）。設定するとポーリング/check は停止する。 */
  realtime?: NotionRealtimeOptions;
}

/** `on` を正規化。未指定時の既定は `["mount", "visibility"]`（開いた時＋再フォーカス）。 */
const toTriggerList = (
  on: NotionRevalidateTrigger | NotionRevalidateTrigger[] | undefined,
): NotionRevalidateTrigger[] => {
  if (on !== undefined) return Array.isArray(on) ? on : [on];
  return ["mount", "visibility"];
};

interface CheckResponse {
  stale: boolean;
  version: string;
}

/** `POST {check}/{collection}/{slug}?v=` を叩き、サーバーの Notion 突合結果を返す。 */
const postCheck = async (url: string, version: string): Promise<CheckResponse | null> => {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}v=${encodeURIComponent(version)}`, {
    method: "POST",
  });
  if (!res.ok) return null;
  return (await res.json()) as CheckResponse | null;
};

/**
 * フレームワーク差分を吸収するための関数 hook。
 * `revalidate` には「現ルートを再評価する」関数を渡す:
 *   - React Router: `() => useRevalidator().revalidate()`
 *   - Next.js: `() => useRouter().refresh()`
 *
 * 更新検知:
 *   - realtime（DO, push 主経路）有効時: `useSWRSubscription` で WebSocket を購読しメッセージで即 revalidate。
 *     ポーリング/check は行わない（push が主経路）。
 *   - realtime 無効時: mount / 再フォーカス（visibility）で `POST /check` を叩き、サーバーが Notion と
 *     突合した結果 `stale: true` のときだけ revalidate する。連続ポーリングは既定で行わない
 *     （`poll.intervalMs` を明示したときのみ一定間隔でも check する）。
 */
export function useRevalidateEffect(
  revalidate: () => void,
  opts: UseNotionRevalidateOptions,
): void {
  const resolvedRealtime = resolveRealtime(opts.realtime);
  // DO（realtime）有効時は check を行わない（push が主経路、ポーリング停止）。
  const useRealtime = Boolean(resolvedRealtime);
  const resolvedCheck = useRealtime ? null : resolvePoll(opts.poll);
  const triggerKey = toTriggerList(opts.on).join(",");

  const checkUrl = resolvedCheck?.url;
  const checkVersion = resolvedCheck?.version;
  const checkIntervalMs = resolvedCheck?.intervalMs;

  // realtime は SSR/初回レンダーでも安定値が要るため、location 依存の組み立ては
  // 文字列キーに落としてから渡す（毎レンダー別オブジェクトになるのを防ぐ）。
  const wsUrl =
    resolvedRealtime && typeof window !== "undefined"
      ? wsUrlFromResolved(resolvedRealtime, window.location.href)
      : null;

  useEffect(() => {
    // check 設定があれば「Notion と突合 → stale のときだけ revalidate」。
    // 無ければ revalidate を直接呼ぶ（DO 有効時は loader 再実行→裏チェック→push で fresh になる）。
    const run = () => {
      if (checkUrl && checkVersion !== undefined) {
        void postCheck(checkUrl, checkVersion).then((r) => {
          if (r?.stale) revalidate();
        });
      } else {
        revalidate();
      }
    };
    const triggers = triggerKey
      .split(",")
      .filter((t): t is NotionRevalidateTrigger => t.length > 0);
    const cleanups: Array<() => void> = [];
    if (triggers.includes("mount")) run();
    if (triggers.includes("visibility")) {
      const handler = () => {
        if (document.visibilityState === "visible") run();
      };
      document.addEventListener("visibilitychange", handler);
      cleanups.push(() => document.removeEventListener("visibilitychange", handler));
    }
    if (checkUrl && checkVersion !== undefined && checkIntervalMs && checkIntervalMs > 0) {
      const id = setInterval(run, checkIntervalMs);
      cleanups.push(() => clearInterval(id));
    }
    return () => {
      for (const c of cleanups) c();
    };
  }, [revalidate, triggerKey, checkUrl, checkVersion, checkIntervalMs]);

  // push 主経路: WebSocket を購読し、更新通知メッセージで即 revalidate する。
  useSWRSubscription(wsUrl, (key, { next }) => {
    const ws = new WebSocket(key);
    ws.addEventListener("message", () => revalidate());
    ws.addEventListener("error", (event) => next(event));
    return () => ws.close();
  });
}
