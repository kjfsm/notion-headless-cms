"use client";

import type { ChildDatabaseBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Database } from "lucide-react";

import { Card, CardHeader, CardTitle } from "../components/ui/card.js";
import { cn } from "../lib/utils";
import type { BlockComponentProps } from "../types";

export function ChildDatabase({
  block,
  className,
}: BlockComponentProps<ChildDatabaseBlockObjectResponse>) {
  return (
    <Card className={cn("my-2 py-3", className)}>
      <CardHeader className="flex flex-row items-center gap-2">
        <Database className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <CardTitle className="text-base">{block.child_database.title}</CardTitle>
      </CardHeader>
    </Card>
  );
}
