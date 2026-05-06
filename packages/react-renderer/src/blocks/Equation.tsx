"use client";

import type { EquationBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import katex from "katex";
import { useMemo } from "react";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

export function Equation({
  block,
  className,
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

  return (
    <div
      className={cn("my-3 overflow-x-auto", className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: katex 出力は信頼できる
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
