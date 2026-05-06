"use client";

import type { ReactNode } from "react";
import { BlockSwitch } from "./BlockSwitch";
import { groupListItems } from "./lib/group-list-items";
import { cn } from "./lib/utils";
import type {
  BlockClassNames,
  ComponentOverrides,
  NotionBlock,
  NotionRendererProps,
} from "./types";

export function NotionRenderer({
  blocks,
  components,
  className,
  classNames,
}: NotionRendererProps) {
  return (
    <div className={cn("notion-renderer", className)}>
      {renderBlocks(blocks, components, classNames)}
    </div>
  );
}

/**
 * 連続する list_item を <ul>/<ol> でくるみつつ、その他のブロックは BlockSwitch で描画する。
 * 各 BlockSwitch には子ブロック描画用の `renderChildren` を渡し、再帰的に同じグルーピングを適用する。
 */
function renderBlocks(
  blocks: NotionBlock[],
  components?: ComponentOverrides,
  classNames?: BlockClassNames,
): ReactNode {
  const groups = groupListItems(blocks);
  return groups.map((group, idx) => {
    if (group.kind === "ul") {
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: グループの順序は安定
        <ul key={`ul-${idx}`} className="my-2 list-disc pl-6">
          {group.items.map((item) => (
            <BlockSwitch
              key={item.id}
              block={item}
              components={components}
              classNames={classNames}
              renderChildren={(c) => renderBlocks(c, components, classNames)}
            />
          ))}
        </ul>
      );
    }
    if (group.kind === "ol") {
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: グループの順序は安定
        <ol key={`ol-${idx}`} className="my-2 list-decimal pl-6">
          {group.items.map((item) => (
            <BlockSwitch
              key={item.id}
              block={item}
              components={components}
              classNames={classNames}
              renderChildren={(c) => renderBlocks(c, components, classNames)}
            />
          ))}
        </ol>
      );
    }
    return (
      <BlockSwitch
        key={group.block.id}
        block={group.block}
        components={components}
        classNames={classNames}
        renderChildren={(c) => renderBlocks(c, components, classNames)}
      />
    );
  });
}
