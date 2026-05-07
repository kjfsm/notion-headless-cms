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
import { useCallback } from "react";
import {
  type UseNotionRevalidateOptions,
  useRevalidateEffect,
} from "./internal/revalidate.js";

export type {
  NotionRevalidateTrigger,
  UseNotionRevalidateOptions,
} from "./internal/revalidate.js";

/**
 * Next.js App Router の `router.refresh()` を内部で呼ぶフック。
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

/** `useNotionRevalidate` を呼ぶだけのレンダー無しコンポーネント。 */
export function NotionRevalidator(props: UseNotionRevalidateOptions): null {
  useNotionRevalidate(props);
  return null;
}
