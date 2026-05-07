// このファイルは `@notion-headless-cms/react-renderer/equation` サブパスとして公開する。
// `katex` を static import するためメイン `index.ts` からは到達させず、
// 数式を表示したい利用側だけが明示的に import + components 注入する。
"use client";

import type { EquationBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import katex from "katex";
import { useMemo } from "react";
import type { BlockComponentProps } from "./types";

/**
 * KaTeX を使って equation ブロックを HTML レンダリングする実体。
 * メイン entry の `Defaults.Equation` は katex を含まないスタブで、
 * 数式を整形表示したい場合は本コンポーネントを動的 import で差し込む:
 *
 * ```tsx
 * import dynamic from "next/dynamic";
 * const Equation = dynamic(() =>
 *   import("@notion-headless-cms/react-renderer/equation").then((m) => m.Equation),
 * );
 * <NotionRenderer blocks={blocks} components={{ Equation }} />;
 * ```
 */
export function Equation({
  block,
}: BlockComponentProps<EquationBlockObjectResponse>) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(block.equation.expression, {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return null;
    }
  }, [block.equation.expression]);

  if (!html) {
    return (
      <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm">
        {block.equation.expression}
      </pre>
    );
  }

  return (
    <div
      className="my-3 overflow-x-auto"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: katex 出力は信頼できる
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
