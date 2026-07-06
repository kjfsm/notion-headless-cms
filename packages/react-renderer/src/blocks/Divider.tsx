"use client";

import { Separator } from "../components/ui/separator";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

export function Divider({ className }: Pick<BlockComponentProps, "className"> = {}) {
  // CSS 変数 (--border) 未定義の環境でも線が見えるよう h-px と bg-border を明示。
  return <Separator className={cn("my-6 h-px bg-border", className)} />;
}
