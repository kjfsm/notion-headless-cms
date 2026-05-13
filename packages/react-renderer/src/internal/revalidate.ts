// router / next の useNotionRevalidate 共通ロジック。
// このモジュールは外部公開しない（パッケージ境界ルールにより internal/ は非公開）。

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
 */
export interface NotionPollOptions {
  /** peekVersion を返すエンドポイント URL */
  url: string;
  /** ページロード時の `item.lastEditedTime`（ポーリング比較基準） */
  version: string;
  /** ポーリング間隔（ms）。既定: 500 */
  intervalMs?: number;
  /** タイムアウト（ms）。既定: 30000 */
  timeoutMs?: number;
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
  // primitive な値に展開してから deps に渡す
  const pollUrl = opts.poll?.url;
  const pollVersion = opts.poll?.version;
  const pollIntervalMs = opts.poll?.intervalMs;
  const pollTimeoutMs = opts.poll?.timeoutMs;

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
