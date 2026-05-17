"use client";

import { useEffect, useState } from "react";

export interface InlineEquationProps {
  expression: string;
}

/**
 * インライン数式の既定描画。
 * SSR 段では等幅フォントの素のテキストを返し、クライアント水和後に動的 import で
 * `katex` を読み込み `displayMode: false` で組版した HTML に置換する。
 * `katex` が peer として入っていない場合はテキストのままフォールバックする。
 */
export function InlineEquation({ expression }: InlineEquationProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const katex = (await import("katex")).default;
        const out = katex.renderToString(expression, {
          displayMode: false,
          throwOnError: false,
        });
        if (!cancelled) setHtml(out);
      } catch {
        // katex 未インストール時は素のテキストフォールバックのまま。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expression]);

  if (html) {
    return (
      <span
        // biome-ignore lint/security/noDangerouslySetInnerHtml: katex の整形済み HTML
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
      {expression}
    </code>
  );
}
