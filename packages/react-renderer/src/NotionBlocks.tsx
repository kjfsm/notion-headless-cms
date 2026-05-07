"use client";

import type { ReactNode } from "react";
import { BlockSwitch } from "./BlockSwitch.js";
import { useNotionContext } from "./context.js";
import { groupListItems } from "./lib/group-list-items.js";
import type { NotionBlock } from "./types.js";

/** ブロック配列を再帰的に描画する。Context から components / classNames を読む。 */
export function NotionBlocks({ blocks }: { blocks: NotionBlock[] }): ReactNode {
  // classNames は BlockSwitch が Context から取得するため、ここでは grouping のみ担当
  useNotionContext(); // Context 内で描画されていることを保証（将来の拡張で使用）
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
