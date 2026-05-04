"use client";

import type { SyncedBlockBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { BlockComponentProps } from "../types";

// synced_block は original / duplicate どちらでも children を素通しで描画すれば見た目は等価。
export function SyncedBlock({
  block,
  renderChildren,
}: BlockComponentProps<SyncedBlockBlockObjectResponse>) {
  if (!block.children || !renderChildren) return null;
  return <>{renderChildren(block.children)}</>;
}
