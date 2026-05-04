"use client";

import type { ComponentType, ReactNode } from "react";
import * as Defaults from "./blocks";
import type {
  BlockComponentProps,
  ComponentOverrides,
  NotionBlock,
} from "./types";

export interface BlockSwitchProps {
  block: NotionBlock;
  components?: ComponentOverrides;
  renderChildren?: (children: NotionBlock[]) => ReactNode;
}

// 各ブロック型ごとに固有プロップ型を持つコンポーネントを単一の Switch で扱うため、
// 型整合は switch 文 (block.type による narrowing) で保証し、
// React 要素を作る側ではプロップを共通形にキャストする。
type AnyBlockComponent = ComponentType<BlockComponentProps>;

/** type で対応する Block コンポーネントを引き当てて描画する。 */
export function BlockSwitch({
  block,
  components,
  renderChildren,
}: BlockSwitchProps) {
  const C = pickComponent(block, components) as AnyBlockComponent;
  return <C block={block} renderChildren={renderChildren} />;
}

// ComponentOverrides の各エントリは BlockComponentProps<具体型> を期待するため、
// 戻り値の型は緩めの unknown にして呼び出し側でキャストする。
// switch の各 case は block.type で narrowing されているので実行時には正しく型整合する。
function pickComponent(block: NotionBlock, o?: ComponentOverrides): unknown {
  switch (block.type) {
    case "paragraph":
      return o?.Paragraph ?? Defaults.Paragraph;
    case "heading_1":
    case "heading_2":
    case "heading_3":
      return o?.Heading ?? Defaults.Heading;
    case "bulleted_list_item":
      return o?.BulletedListItem ?? Defaults.BulletedListItem;
    case "numbered_list_item":
      return o?.NumberedListItem ?? Defaults.NumberedListItem;
    case "to_do":
      return o?.ToDo ?? Defaults.ToDo;
    case "toggle":
      return o?.Toggle ?? Defaults.Toggle;
    case "callout":
      return o?.Callout ?? Defaults.Callout;
    case "quote":
      return o?.Quote ?? Defaults.Quote;
    case "code":
      return o?.Code ?? Defaults.Code;
    case "equation":
      return o?.Equation ?? Defaults.Equation;
    case "divider":
      return o?.Divider ?? Defaults.Divider;
    case "image":
      return o?.Image ?? Defaults.Image;
    case "video":
      return o?.Video ?? Defaults.Video;
    case "audio":
      return o?.Audio ?? Defaults.Audio;
    case "file":
      return o?.File ?? Defaults.File;
    case "pdf":
      return o?.Pdf ?? Defaults.Pdf;
    case "bookmark":
      return o?.Bookmark ?? Defaults.Bookmark;
    case "link_preview":
      return o?.LinkPreview ?? Defaults.LinkPreview;
    case "link_to_page":
      return o?.LinkToPage ?? Defaults.LinkToPage;
    case "child_page":
      return o?.ChildPage ?? Defaults.ChildPage;
    case "child_database":
      return o?.ChildDatabase ?? Defaults.ChildDatabase;
    case "embed":
      return o?.Embed ?? Defaults.Embed;
    case "table":
      return o?.Table ?? Defaults.Table;
    case "column_list":
      return o?.ColumnList ?? Defaults.ColumnList;
    case "column":
      return o?.Column ?? Defaults.Column;
    case "synced_block":
      return o?.SyncedBlock ?? Defaults.SyncedBlock;
    case "breadcrumb":
      return o?.Breadcrumb ?? Defaults.Breadcrumb;
    case "table_of_contents":
      return o?.TableOfContents ?? Defaults.TableOfContents;
    default:
      return o?.Unsupported ?? Defaults.Unsupported;
  }
}
