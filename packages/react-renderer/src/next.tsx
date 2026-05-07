"use client";

// Next.js App Router 向けの再検証ヘルパ。
// 利用例:
//   <NotionRevalidator />            // Server Component (page.tsx) に直接置ける
//   useNotionRevalidate({ on: ["mount", "visibility"] });
//
// `useRouter().refresh()` は現在のルートの Server Component を再評価し、RSC
// ストリームを差分で受け取って画面を静かに更新する。クエリも別 API fetch も
// 発生しないため、URL は変わらず、UI も chatter なく書き換わる。

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 再検証のトリガー。
 * - "mount": ハイドレーション直後に 1 度だけ実行
 * - "visibility": タブ可視化の度に実行
 */
export type NotionRevalidateTrigger = "mount" | "visibility";

export interface UseNotionRevalidateOptions {
  /** 既定値: "mount"。複数指定可。 */
  on?: NotionRevalidateTrigger | NotionRevalidateTrigger[];
}

const toTriggerList = (
  on: NotionRevalidateTrigger | NotionRevalidateTrigger[] | undefined,
): NotionRevalidateTrigger[] => {
  if (!on) return ["mount"];
  return Array.isArray(on) ? on : [on];
};

/**
 * Next.js App Router の `router.refresh()` を内部で呼ぶフック。
 */
export function useNotionRevalidate(
  opts: UseNotionRevalidateOptions = {},
): void {
  const router = useRouter();
  const triggerKey = toTriggerList(opts.on).join(",");

  useEffect(() => {
    const triggers = triggerKey.split(",") as NotionRevalidateTrigger[];
    if (triggers.includes("mount")) router.refresh();
    if (triggers.includes("visibility")) {
      const handler = () => {
        if (document.visibilityState === "visible") router.refresh();
      };
      document.addEventListener("visibilitychange", handler);
      return () => document.removeEventListener("visibilitychange", handler);
    }
  }, [router, triggerKey]);
}

/** `useNotionRevalidate` を呼ぶだけのレンダー無しコンポーネント。 */
export function NotionRevalidator(props: UseNotionRevalidateOptions): null {
  useNotionRevalidate(props);
  return null;
}
