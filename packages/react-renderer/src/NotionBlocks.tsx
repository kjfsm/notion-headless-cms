"use client";

import { type ReactNode, useMemo } from "react";
import { BlockSwitch } from "./BlockSwitch.js";
import { NotionContext, useNotionContext } from "./context.js";
import { groupListItems } from "./lib/group-list-items.js";
import type { NotionBlock } from "./types.js";

const OL_STYLES = ["list-decimal", "list-[lower-alpha]", "list-[lower-roman]"];

/**
 * ブロック配列を描画する。連続する `bulleted_list_item` / `numbered_list_item` は
 * 1 つの `<ul>` / `<ol>` にまとめてから子要素を `BlockSwitch` で描画する。
 * `<ol>` の list-style は `listDepth` でローテートさせ、ネスト時に
 * `decimal → lower-alpha → lower-roman` を循環する（Notion 本家挙動）。
 *
 * `NotionRenderer` の内側、既に `NotionContext` が確立された状態で使う。
 * トップレベルでは {@link NotionRenderer} を使う。
 *
 * @example
 * ```tsx
 * function Toggle({ children }: { children: NotionBlock[] }) {
 *   return <details><NotionBlocks blocks={children} /></details>;
 * }
 * ```
 *
 * @see {@link NotionRenderer} Context を確立するトップレベルエントリ。
 */
export function NotionBlocks({ blocks }: { blocks: NotionBlock[] }): ReactNode {
  const ctx = useNotionContext();
  const depth = ctx.listDepth ?? 0;
  const olClass = OL_STYLES[depth % OL_STYLES.length] ?? "list-decimal";

  const nestedCtx = useMemo(
    () => ({ ...ctx, listDepth: depth + 1 }),
    [ctx, depth],
  );

  const groups = groupListItems(blocks);
  return (
    <NotionContext.Provider value={nestedCtx}>
      {groups.map((group, idx) => {
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
            <ol key={`ol-${idx}`} className={`my-2 pl-6 ${olClass}`}>
              {group.items.map((item) => (
                <BlockSwitch key={item.id} block={item} />
              ))}
            </ol>
          );
        }
        return <BlockSwitch key={group.block.id} block={group.block} />;
      })}
    </NotionContext.Provider>
  );
}
