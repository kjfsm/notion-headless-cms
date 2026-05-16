"use client";

import type { FileBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { FileIcon } from "lucide-react";
import type { ElementType } from "react";
import {
  Item,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "../components/ui/item.js";
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
    <figure className={cn("my-3", className)}>
      <Item variant="outline" asChild>
        <LinkComp href={href} target="_blank" rel="noopener noreferrer">
          <ItemMedia variant="icon">
            <FileIcon aria-hidden />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{fileName(block)}</ItemTitle>
          </ItemContent>
        </LinkComp>
      </Item>
      {block.file.caption.length > 0 ? (
        <Caption value={block.file.caption} variant="block" />
      ) : null}
    </figure>
  );
}
