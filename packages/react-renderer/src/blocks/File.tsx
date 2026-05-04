"use client";

import type { FileBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { FileIcon } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

function fileUrl(file: FileBlockObjectResponse["file"]): string {
  return file.type === "external" ? file.external.url : file.file.url;
}

function fileName(block: FileBlockObjectResponse): string {
  if (block.file.name) return block.file.name;
  try {
    const u = new URL(fileUrl(block.file));
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
          href={fileUrl(block.file)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {fileName(block)}
        </a>
      </CardContent>
      {block.file.caption.length > 0 ? (
        <CardContent className="pt-0 text-sm text-muted-foreground">
          <RichText value={block.file.caption} />
        </CardContent>
      ) : null}
    </Card>
  );
}
