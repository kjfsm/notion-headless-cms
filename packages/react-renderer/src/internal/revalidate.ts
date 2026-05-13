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
 * バックグラウンド更新の完了をポーリングで検出するオプション。
 * `peekVersion` エンドポイントを叩き、`cachedAt` が変化したら更新完了と判断する。
 */
export interface NotionPollOptions {
  /** `peekVersion` を返すエンドポイント URL（slug 等クエリ込みで渡す）。 */
  url: string;
  /** ローダーから受け取った現在の `notionUpdatedAt` 値。変化を検出する基準。 */
  version: string;
  /** ポーリング間隔 (ms)。デフォルト: 500。 */
  intervalMs?: number;
  /** ポーリングの最大待機時間 (ms)。デフォルト: 5000。 */
  timeoutMs?: number;
}

export interface UseNotionRevalidateOptions {
  /** 既定値: "mount"。複数指定可。`poll` 指定時は mount の即時実行がポーリングに置き換わる。 */
  on?: NotionRevalidateTrigger | NotionRevalidateTrigger[];
  /** 指定するとバックグラウンド更新の完了を KV ポーリングで検出してから revalidate する。 */
  poll?: NotionPollOptions;
}

/** `on` を正規化。未指定時は `["mount"]`。 */
const toTriggerList = (
  on: NotionRevalidateTrigger | NotionRevalidateTrigger[] | undefined,
): NotionRevalidateTrigger[] => {
  if (!on) return ["mount"];
  return Array.isArray(on) ? on : [on];
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
  const triggerKey = toTriggerList(opts.on).join(",");
  const pollUrl = opts.poll?.url ?? "";
  const pollVersion = opts.poll?.version ?? "";
  const pollIntervalMs = opts.poll?.intervalMs ?? 500;
  const pollTimeoutMs = opts.poll?.timeoutMs ?? 5000;
  const hasPoll = Boolean(opts.poll);

  useEffect(() => {
    const triggers = triggerKey
      .split(",")
      .filter((t): t is NotionRevalidateTrigger => t.length > 0);

    const addVisibilityListener = () => {
      const handler = () => {
        if (document.visibilityState === "visible") revalidate();
      };
      document.addEventListener("visibilitychange", handler);
      return () => document.removeEventListener("visibilitychange", handler);
    };

    if (hasPoll) {
      let initialCachedAt: number | null = null;
      let stopped = false;

      const runPoll = async () => {
        if (stopped) return;
        try {
          const res = await fetch(pollUrl);
          if (!res.ok || stopped) return;
          const data = (await res.json()) as {
            notionUpdatedAt: string;
            cachedAt: number;
          } | null;
          if (!data || stopped) return;

          if (data.notionUpdatedAt !== pollVersion) {
            stopped = true;
            revalidate();
            return;
          }
          if (initialCachedAt === null) {
            initialCachedAt = data.cachedAt;
          } else if (data.cachedAt > initialCachedAt) {
            stopped = true;
          }
        } catch {
          // fetch エラーはポーリング継続
        }
      };

      runPoll();
      const timer = setInterval(runPoll, pollIntervalMs);
      const deadline = setTimeout(() => {
        stopped = true;
        clearInterval(timer);
      }, pollTimeoutMs);

      if (triggers.includes("visibility")) {
        const removeVisibility = addVisibilityListener();
        return () => {
          stopped = true;
          clearInterval(timer);
          clearTimeout(deadline);
          removeVisibility();
        };
      }

      return () => {
        stopped = true;
        clearInterval(timer);
        clearTimeout(deadline);
      };
    }

    if (triggers.includes("mount")) revalidate();
    if (triggers.includes("visibility")) {
      return addVisibilityListener();
    }
  }, [revalidate, triggerKey, hasPoll, pollUrl, pollVersion, pollIntervalMs, pollTimeoutMs]);
}
