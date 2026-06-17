"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  type UseNotionRevalidateOptions,
  useRevalidateEffect,
} from "./internal/revalidate.js";

export type {
  NotionPollOptions,
  NotionRealtimeOptions,
  NotionRevalidateTrigger,
  UseNotionRevalidateOptions,
} from "./internal/revalidate.js";

/**
 * Next.js App Router で SWR 再検証を `router.refresh()` 経由で発火させるフック。
 * RSC ストリームを差分で受け取るため、URL も変わらず別 API fetch も発生しない。
 *
 * @example
 *   useNotionRevalidate({ on: ["mount", "visibility"] });
 */
export function useNotionRevalidate(
  opts: UseNotionRevalidateOptions = {},
): void {
  const router = useRouter();
  const stable = useCallback(() => {
    router.refresh();
  }, [router]);
  useRevalidateEffect(stable, opts);
}

/**
 * マウント後に `router.refresh()` を呼び、サーバー側 SWR で差し替わった最新データを
 * 別 fetch なしで取り込むレンダー無しコンポーネント。
 * `poll` を指定すると KV ポーリングで更新完了を検出してから revalidate する。
 */
export function NotionRevalidator(props: UseNotionRevalidateOptions): null {
  useNotionRevalidate(props);
  return null;
}
