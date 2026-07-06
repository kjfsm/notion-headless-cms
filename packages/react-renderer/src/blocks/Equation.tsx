"use client";

import type { EquationBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { useEffect, useState } from "react";

import { cn } from "../lib/utils.js";
import type { BlockComponentProps } from "../types.js";

/**
 * ブロック equation の既定描画。
 * `notion-katex` enricher が付与した `__cachedHtml` があればそれを使い、無ければ
 * クライアントで `katex` を動的 import して `displayMode: true` で組版する。
 * peer に `katex` が無いか KaTeX が失敗したら原文を `<pre>` で出す。
 */
export function Equation({ block, className }: BlockComponentProps<EquationBlockObjectResponse>) {
  const cachedHtml = (block.equation as { expression: string; __cachedHtml?: string }).__cachedHtml;
  const expression = block.equation.expression;
  const [html, setHtml] = useState<string | null>(cachedHtml ?? null);

  useEffect(() => {
    // import.meta.env.SSR は Vite が静的に置換する定数のため、この early return により
    // 後続の katex の動的 import が SSR/Worker バンドルの到達可能グラフから外れ、
    // tree-shaking で除外される。
    if (import.meta.env.SSR || cachedHtml) return;
    let cancelled = false;
    void (async () => {
      try {
        const katex = (await import("katex")).default;
        const out = katex.renderToString(expression, {
          displayMode: true,
          throwOnError: false,
        });
        if (!cancelled) setHtml(out);
      } catch {
        // katex 未インストール時は <pre> フォールバックのまま。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cachedHtml, expression]);

  if (html) {
    return (
      <div
        className={cn("my-3 overflow-x-auto", className)}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: katex の整形済み HTML
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <pre
      className={cn("my-3 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm", className)}
    >
      {expression}
    </pre>
  );
}
