"use client";

import { useCallback } from "react";
import { useRevalidator } from "react-router";
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
 * React Router v7 (Framework モード) で SWR 再検証を loader 経由で発火させるフック。
 * 別 API への fetch を発生させず、loader を再走させてサーバ側 SWR の最新データへ
 * 静かに切り替える。
 *
 * @example
 *   useNotionRevalidate(); // マウント時 1 度
 *   useNotionRevalidate({ on: ["mount", "visibility"] });
 */
export function useNotionRevalidate(
  opts: UseNotionRevalidateOptions = {},
): void {
  const { revalidate } = useRevalidator();
  // useRevalidator が返す revalidate は再描画ごとに別インスタンス。
  // useCallback で安定化しないと useRevalidateEffect の deps が毎回変わる。
  const stable = useCallback(() => {
    revalidate();
  }, [revalidate]);
  useRevalidateEffect(stable, opts);
}

/**
 * マウント後に loader を 1 度再走させ、サーバー側 SWR で差し替わった最新データを
 * 別 fetch なしで取り込むレンダー無しコンポーネント。
 * `poll` を指定すると KV ポーリングで更新完了を検出してから revalidate する。
 */
export function NotionRevalidator(props: UseNotionRevalidateOptions): null {
  useNotionRevalidate(props);
  return null;
}
