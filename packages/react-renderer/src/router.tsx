"use client";

// React Router v7 (Framework モード) 向けの再検証ヘルパ。
// 利用例:
//   useNotionRevalidate();                       // マウント時に 1 度だけ revalidate
//   useNotionRevalidate({ on: ["mount", "visibility"] });
//   <NotionRevalidator />                        // root.tsx などに置けるコンポーネント版
//
// React Router 自身の loader / useRevalidator を使うため、別 API への fetch を発生
// させずに loader を再走させ、サーバ側 SWR で差し替えられた最新データへ画面が
// 静かに切り替わる。

import { useEffect } from "react";
import { useRevalidator } from "react-router";

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

const toTriggerList = (
  on: NotionRevalidateTrigger | NotionRevalidateTrigger[] | undefined,
): NotionRevalidateTrigger[] => {
  if (!on) return ["mount"];
  return Array.isArray(on) ? on : [on];
};

/**
 * React Router の `useRevalidator` を内部で呼ぶフック。
 * クエリ無し・別 API fetch 無しで loader を再走させる。
 */
export function useNotionRevalidate(
  opts: UseNotionRevalidateOptions = {},
): void {
  const { revalidate } = useRevalidator();
  // 配列を直接 deps に渡すと毎レンダリング再実行されるため、
  // 安定したキー文字列にしてから effect 内で再展開する。
  const triggerKey = toTriggerList(opts.on).join(",");

  useEffect(() => {
    const triggers = triggerKey.split(",") as NotionRevalidateTrigger[];
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

/**
 * `useNotionRevalidate` を呼ぶだけのレンダー無しコンポーネント。
 * `root.tsx` や個別ルートで `<NotionRevalidator />` を 1 つ置くだけで
 * SWR 体験が有効になる。
 */
export function NotionRevalidator(props: UseNotionRevalidateOptions): null {
  useNotionRevalidate(props);
  return null;
}
