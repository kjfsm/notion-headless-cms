"use client";

import type { ChildDatabaseBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Database } from "lucide-react";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

export function ChildDatabase({
  block,
  className,
}: BlockComponentProps<ChildDatabaseBlockObjectResponse>) {
  return (
    <div className={cn("my-2 flex items-baseline gap-2", className)}>
      <Database
        className="size-4 self-center text-muted-foreground"
        aria-hidden
      />
      <span>{block.child_database.title}</span>
    </div>
  );
}
