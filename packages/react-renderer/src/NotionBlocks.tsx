"use client";

import type { ReactNode } from "react";
import { BlockSwitch } from "./BlockSwitch.js";
import { useNotionContext } from "./context.js";
import { groupListItems } from "./lib/group-list-items.js";
import type { NotionBlock } from "./types.js";

/**
 * ブロック配列を描画する。連続する `bulleted_list_item` / `numbered_list_item` は
 * 1 つの `<ul>` / `<ol>` にまとめてから子要素を `BlockSwitch` で描画する。
 */
export function NotionBlocks({ blocks }: { blocks: NotionBlock[] }): ReactNode {
  // 副作用は無いが、Context スコープ外での呼び出しを Hook 規約で検出させる目的で読む
  useNotionContext();
  const groups = groupListItems(blocks);
  return groups.map((group, idx) => {
    if (group.kind === "ul") {
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: グループ順序は安定
        <ul key={`ul-${idx}`} className="my-2 list-disc pl-6">
          {group.items.map((item) => (
            <BlockSwitch key={item.id} block={item} />
          ))}
        </ul>
      );
    }
    if (group.kind === "ol") {
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: グループ順序は安定
        <ol key={`ol-${idx}`} className="my-2 list-decimal pl-6">
          {group.items.map((item) => (
            <BlockSwitch key={item.id} block={item} />
          ))}
        </ol>
      );
    }
    return <BlockSwitch key={group.block.id} block={group.block} />;
  });
}
