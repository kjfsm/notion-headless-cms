"use client";

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

/** `useNotionRevalidate` を呼ぶだけのレンダー無しコンポーネント (page.tsx 用)。 */
export function NotionRevalidator(props: UseNotionRevalidateOptions): null {
  useNotionRevalidate(props);
  return null;
}
