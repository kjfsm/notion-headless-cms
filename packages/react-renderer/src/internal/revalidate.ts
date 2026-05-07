// router / next の useNotionRevalidate 共通ロジック。
// このモジュールは外部公開しない（パッケージ境界ルールにより internal/ は非公開）。

import { useEffect } from "react";

/**
 * 再検証のトリガー。
 * - "mount": ハイドレーション直後に 1 度だけ実行
 * - "visibility": タブ可視化 (`visibilitychange` で hidden→visible) の度に実行
 */
export type NotionRevalidateTrigger = "mount" | "visibility";

export interface UseNotionRevalidateOptions {
  /** 既定値: "mount"。複数指定可。 */
  on?: NotionRevalidateTrigger | NotionRevalidateTrigger[];
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
}
