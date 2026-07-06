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
 * `listDepth` のインクリメントは `ul`/`ol` グループの直下（= 実際にリスト項目である
 * 子ツリー）にのみ及ぶよう、グループ単位で `NotionContext.Provider` をスコープする。
 * 単体ブロック（toggle/callout/quote 等の汎用コンテナ）は ambient な `ctx` を
 * そのまま素通しするため、その内側で `NotionBlocks` が再帰しても `<ol>` がネストして
 * いないのに list-style がローテートすることはない（リスト以外のネスト深さと
 * 混同していた旧実装のバグ修正）。
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

  const nestedCtx = useMemo(() => ({ ...ctx, listDepth: depth + 1 }), [ctx, depth]);

  const groups = groupListItems(blocks);
  return (
    <>
      {groups.map((group, idx) => {
        if (group.kind === "ul") {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: グループ順序は安定
            <ul key={`ul-${idx}`} className="my-2 list-disc pl-6">
              <NotionContext.Provider value={nestedCtx}>
                {group.items.map((item) => (
                  <BlockSwitch key={item.id} block={item} />
                ))}
              </NotionContext.Provider>
            </ul>
          );
        }
        if (group.kind === "ol") {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: グループ順序は安定
            <ol key={`ol-${idx}`} className={`my-2 pl-6 ${olClass}`}>
              <NotionContext.Provider value={nestedCtx}>
                {group.items.map((item) => (
                  <BlockSwitch key={item.id} block={item} />
                ))}
              </NotionContext.Provider>
            </ol>
          );
        }
        // 非リストの単体ブロック: ambient な ctx をそのまま使う(depth を増やさない)。
        return <BlockSwitch key={group.block.id} block={group.block} />;
      })}
    </>
  );
}
