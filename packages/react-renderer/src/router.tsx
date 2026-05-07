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

import { useCallback } from "react";
import { useRevalidator } from "react-router";
import {
  type UseNotionRevalidateOptions,
  useRevalidateEffect,
} from "./internal/revalidate.js";

export type {
  NotionRevalidateTrigger,
  UseNotionRevalidateOptions,
} from "./internal/revalidate.js";

/**
 * React Router の `useRevalidator` を内部で呼ぶフック。
 * クエリ無し・別 API fetch 無しで loader を再走させる。
 */
export function useNotionRevalidate(
  opts: UseNotionRevalidateOptions = {},
): void {
  const { revalidate } = useRevalidator();
  // useRevalidator が返す `revalidate` は再描画ごとに新インスタンスのことがあるため
  // useCallback で安定化させ、内部 effect の deps を確定させる。
  const stable = useCallback(() => {
    revalidate();
  }, [revalidate]);
  useRevalidateEffect(stable, opts);
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
