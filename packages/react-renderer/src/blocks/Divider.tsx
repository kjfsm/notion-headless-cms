"use client";

import { Separator } from "../components/ui/separator";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

export function Divider({
  className,
}: Pick<BlockComponentProps, "className"> = {}) {
  return <Separator className={cn("my-6", className)} />;
}
