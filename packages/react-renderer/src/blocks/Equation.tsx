"use client";

import type { EquationBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

/**
 * デフォルトの Equation スタブ。bundle に katex を混入させない。
 *
 * `notion-katex` enricher によって `block.equation.__cachedHtml` が付与されている場合は
 * `dangerouslySetInnerHTML` でそのまま描画する（Workers バンドルに katex 不要）。
 * `__cachedHtml` がない場合は式を等幅フォントの `<pre>` で素のまま表示する。
 *
 * KaTeX で動的に整形表示したい場合は `@notion-headless-cms/react-renderer/equation`
 * から Equation を import し、`<NotionRenderer components={{ Equation }} />` で差し込む。
 */
export function Equation({
  block,
  className,
}: BlockComponentProps<EquationBlockObjectResponse>) {
  // notion-katex が fetch 時に付与した pre-rendered HTML があればそちらを使う
  const cachedHtml = (
    block.equation as { expression: string; __cachedHtml?: string }
  ).__cachedHtml;

  if (cachedHtml) {
    return (
      <div
        className={cn("my-3 overflow-x-auto", className)}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: notion-katex の pre-render 済み出力
        dangerouslySetInnerHTML={{ __html: cachedHtml }}
      />
    );
  }

  return (
    <pre
      className={cn(
        "my-3 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm",
        className,
      )}
    >
      {block.equation.expression}
    </pre>
  );
}
