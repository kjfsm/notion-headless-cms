"use client";

import type { FileBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { FileIcon } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { getFileUrl } from "../lib/notion-file";
import { Caption } from "../rich-text/Caption";
import type { BlockComponentProps } from "../types";

function fileName(block: FileBlockObjectResponse): string {
  if (block.file.name) return block.file.name;
  try {
    const u = new URL(getFileUrl(block.file));
    return u.pathname.split("/").pop() ?? u.pathname;
  } catch {
    return "file";
  }
}

export function File({ block }: BlockComponentProps<FileBlockObjectResponse>) {
  return (
    <Card className="my-3">
      <CardContent className="flex items-center gap-3 p-3">
        <FileIcon
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <a
          href={getFileUrl(block.file)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {fileName(block)}
        </a>
      </CardContent>
      {block.file.caption.length > 0 ? (
        <CardContent className="pt-0">
          <Caption value={block.file.caption} variant="block" />
        </CardContent>
      ) : null}
    </Card>
  );
}
