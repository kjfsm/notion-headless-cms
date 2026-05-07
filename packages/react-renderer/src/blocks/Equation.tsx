"use client";

import type { EquationBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { BlockComponentProps } from "../types";

/**
 * デフォルトの Equation スタブ。bundle に katex を混入させないため、
 * ここでは式を等幅フォントの `<pre>` で素のまま表示するだけにとどめる。
 *
 * KaTeX で整形表示したい場合は `@notion-headless-cms/react-renderer/equation`
 * から Equation を import し、`<NotionRenderer components={{ Equation }} />`
 * で差し込む（next/dynamic と組み合わせれば別チャンク化される）。
 */
export function Equation({
  block,
}: BlockComponentProps<EquationBlockObjectResponse>) {
  return (
    <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm">
      {block.equation.expression}
    </pre>
  );
}
