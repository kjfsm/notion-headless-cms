"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils.js";
import { Button } from "./ui/button.js";

/**
 * クリップボードへコピーするボタン。コピー後 2 秒だけチェックアイコンに切り替わる。
 * shadcn 公式 docs の `copy-button` 相当（アイコンは lucide-react）。
 *
 * @param value コピーする文字列
 */
export function CopyButton({
  value,
  className,
  variant = "ghost",
  ...props
}: React.ComponentProps<typeof Button> & { value: string }) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (!hasCopied) return;
    const timer = setTimeout(() => setHasCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [hasCopied]);

  return (
    <Button
      data-slot="copy-button"
      size="icon"
      variant={variant}
      className={cn("size-7 text-muted-foreground", className)}
      onClick={() => {
        if (typeof navigator === "undefined" || !navigator.clipboard) return;
        void navigator.clipboard.writeText(value);
        setHasCopied(true);
      }}
      {...props}
    >
      <span className="sr-only">{hasCopied ? "Copied" : "Copy"}</span>
      {hasCopied ? <Check /> : <Copy />}
    </Button>
  );
}
