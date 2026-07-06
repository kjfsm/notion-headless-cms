"use client";

import type { SyncedBlockBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { NotionBlocks } from "../NotionBlocks.js";
import type { BlockComponentProps } from "../types.js";

// synced_block は original / duplicate どちらでも children を素通しで描画すれば見た目は等価。
export function SyncedBlock({ block }: BlockComponentProps<SyncedBlockBlockObjectResponse>) {
  if (!block.children) return null;
  return <NotionBlocks blocks={block.children} />;
}
