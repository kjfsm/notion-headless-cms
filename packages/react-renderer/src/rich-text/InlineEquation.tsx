"use client";

import { useEffect, useState } from "react";

export interface InlineEquationProps {
  expression: string;
  /**
   * 同期時（`@notion-headless-cms/cms` の katex TransformStage 等）に事前組版された
   * HTML。あれば SSR からそのまま確定描画し、クライアント側の katex 読み込みをスキップする。
   */
  cachedHtml?: string;
}

/**
 * インライン数式の既定描画。
 * `cachedHtml` があればそれを SSR から確定描画する。無ければ SSR 段で等幅フォントの
 * 素のテキストを返し、クライアント水和後に動的 import で `katex` を読み込み
 * `displayMode: false` で組版した HTML に置換する。
 * `katex` が peer として入っていない場合はテキストのままフォールバックする。
 */
export function InlineEquation({
  expression,
  cachedHtml,
}: InlineEquationProps) {
  const [html, setHtml] = useState<string | null>(cachedHtml ?? null);

  useEffect(() => {
    // import.meta.env.SSR は Vite が静的に置換する定数のため、この early return により
    // 後続の katex の動的 import が SSR/Worker バンドルの到達可能グラフから外れ、
    // tree-shaking で除外される。
    if (import.meta.env.SSR || cachedHtml) return;
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
  }, [cachedHtml, expression]);

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
