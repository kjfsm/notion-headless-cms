import { useEffect } from "react";

/**
 * 再検証のトリガー。
 * - "mount": ハイドレーション直後に 1 度だけ実行
 * - "visibility": タブ可視化 (`visibilitychange` で hidden→visible) の度に実行
 */
export type NotionRevalidateTrigger = "mount" | "visibility";

/**
 * KV ポーリングのオプション。
 * バックグラウンド SWR 更新の完了を検出してから revalidate するためのもの。
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
  /** ポーリング間隔（ms）。既定: 500 */
  intervalMs?: number;
  /** タイムアウト（ms）。既定: 30000 */
  timeoutMs?: number;
}

/** `cms.handler()` の既定 basePath。poll URL 導出のデフォルト。 */
const DEFAULT_CMS_BASE_PATH = "/api/cms";

/**
 * poll オプションから実際に叩く URL と比較バージョンを解決する。
 * `url`/`version` を明示しても、`collection`+`item`（or `slug`）からの導出でもよい。
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

export interface UseNotionRevalidateOptions {
  /** 既定値: "mount"。複数指定可。`poll` 指定時はトリガーなしがデフォルト。 */
  on?: NotionRevalidateTrigger | NotionRevalidateTrigger[];
  /** KV ポーリングで更新完了後に revalidate する。指定時は `on` の既定が空になる。 */
  poll?: NotionPollOptions;
}

/** `on` を正規化。未指定時は `poll` があれば `[]`、なければ `["mount"]`。 */
const toTriggerList = (
  on: NotionRevalidateTrigger | NotionRevalidateTrigger[] | undefined,
  hasPoll: boolean,
): NotionRevalidateTrigger[] => {
  if (on !== undefined) return Array.isArray(on) ? on : [on];
  return hasPoll ? [] : ["mount"];
};

/**
 * フレームワーク差分を吸収するための関数 hook。
 * `useRevalidate` には「現ルートを再評価する」関数を渡す:
 *   - React Router: `() => useRevalidator().revalidate()`
 *   - Next.js: `() => useRouter().refresh()`
 *
 * 配列を直接 deps に入れると毎レンダリング再実行されるため、
 * 安定したキー文字列にしてから effect 内で再展開している。
 */
export function useRevalidateEffect(
  revalidate: () => void,
  opts: UseNotionRevalidateOptions,
): void {
  const hasPoll = Boolean(opts.poll);
  const triggerKey = toTriggerList(opts.on, hasPoll).join(",");
  // poll オブジェクトは毎レンダリングで新インスタンスになる可能性があるため
  // 解決後の primitive な値に展開してから deps に渡す
  const resolvedPoll = resolvePoll(opts.poll);
  const pollUrl = resolvedPoll?.url;
  const pollVersion = resolvedPoll?.version;
  const pollIntervalMs = resolvedPoll?.intervalMs;
  const pollTimeoutMs = resolvedPoll?.timeoutMs;

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

  useEffect(() => {
    if (!pollUrl || pollVersion === undefined) return;
    const intervalMs = pollIntervalMs ?? 500;
    const timeoutMs = pollTimeoutMs ?? 30_000;
    let initialCachedAt: number | undefined;
    let stopped = false;

    const timer = setInterval(async () => {
      if (stopped) return;
      try {
        const res = await fetch(pollUrl);
        if (!res.ok) return;
        const data = (await res.json()) as {
          notionUpdatedAt: string;
          cachedAt: number;
        } | null;
        if (!data) return;

        if (initialCachedAt === undefined) {
          initialCachedAt = data.cachedAt;
          return;
        }

        if (data.notionUpdatedAt !== pollVersion) {
          // Notion 側の更新がキャッシュに反映された
          stopped = true;
          clearInterval(timer);
          revalidate();
        } else if (data.cachedAt > initialCachedAt) {
          // 差分なしでバックグラウンド確認が完了した（更新不要）
          stopped = true;
          clearInterval(timer);
        }
      } catch {
        // フェッチ失敗は無視してポーリング継続
      }
    }, intervalMs);

    const timeout = setTimeout(() => {
      stopped = true;
      clearInterval(timer);
    }, timeoutMs);

    return () => {
      stopped = true;
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [revalidate, pollUrl, pollVersion, pollIntervalMs, pollTimeoutMs]);
}
