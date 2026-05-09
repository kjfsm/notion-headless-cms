"use client";

import type { FileBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { FileIcon } from "lucide-react";
import type { ElementType } from "react";
import { Card, CardContent } from "../components/ui/card";
import { useNotionContext } from "../context";
import { getFileUrl } from "../lib/notion-file";
import { cn } from "../lib/utils";
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

export function File({
  block,
  className,
}: BlockComponentProps<FileBlockObjectResponse>) {
  const { resolveImageUrl, Link: LinkSlot } = useNotionContext();
  const rawUrl = getFileUrl(block.file);
  const href = resolveImageUrl ? resolveImageUrl(rawUrl, block) : rawUrl;
  const LinkComp = (LinkSlot ?? "a") as ElementType<
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  >;
  return (
    <Card className={cn("my-3", className)}>
      <CardContent className="flex items-center gap-3 p-3">
        <FileIcon
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <LinkComp
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {fileName(block)}
        </LinkComp>
      </CardContent>
      {block.file.caption.length > 0 ? (
        <CardContent className="pt-0">
          <Caption value={block.file.caption} variant="block" />
        </CardContent>
      ) : null}
    </Card>
  );
}
