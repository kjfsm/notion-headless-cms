import type * as React from "react";
import { cn } from "../lib/utils.js";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js";

/**
 * shadcn 公式 docs の `callout` 相当。`Alert` を docs 風の surface トーンで包む
 * プレゼンテーション専用コンポーネント。Notion の callout ブロックは
 * `blocks/Callout.tsx` がこれをラップして描画する。
 */
export function Callout({
  title,
  children,
  icon,
  className,
  variant = "default",
  ...props
}: Omit<React.ComponentProps<typeof Alert>, "variant"> & {
  icon?: React.ReactNode;
  variant?: "default" | "info" | "warning";
}) {
  return (
    <Alert
      data-variant={variant}
      className={cn(
        "mt-6 w-auto rounded-xl border-surface bg-surface text-surface-foreground md:-mx-1 **:[code]:border",
        className,
      )}
      {...props}
    >
      {icon}
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="text-card-foreground/80">
        {children}
      </AlertDescription>
    </Alert>
  );
}
