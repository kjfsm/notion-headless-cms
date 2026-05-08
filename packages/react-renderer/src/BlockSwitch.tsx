"use client";

import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { ComponentType } from "react";
import * as Defaults from "./blocks/index.js";
import { useNotionContext } from "./context.js";
import type {
  BlockComponentProps,
  ComponentOverrides,
  NotionBlock,
} from "./types.js";

export interface BlockSwitchProps {
  block: NotionBlock;
}

// ブロック型ごとに別プロップ型を持つコンポーネント群を単一の Switch でディスパッチする。
// 型整合は block.type による narrowing で保証し、要素を作る側はプロップを共通形にキャスト。
type AnyBlockComponent = ComponentType<BlockComponentProps>;

/** `block.type` から対応するコンポーネントを Context 経由で引き当てて描画する。 */
export function BlockSwitch({ block }: BlockSwitchProps) {
  const { components, classNames } = useNotionContext();
  const C = pickComponent(block, components) as AnyBlockComponent;
  return <C block={block} className={classNames?.[block.type]} />;
}

// `@notionhq/client` 側で BlockObjectResponse の union に新 type が増えると
// satisfies が型エラーになる (= ライブラリ追従漏れの検知)。自前の type-test を
// 置かずに @notionhq/client の型を直接使って網羅性を保証する。
function pickComponent(block: NotionBlock, o?: ComponentOverrides): unknown {
  const map = {
    paragraph: o?.Paragraph ?? Defaults.Paragraph,
    heading_1: o?.Heading ?? Defaults.Heading,
    heading_2: o?.Heading ?? Defaults.Heading,
    heading_3: o?.Heading ?? Defaults.Heading,
    heading_4: o?.Heading ?? Defaults.Heading,
    bulleted_list_item: o?.BulletedListItem ?? Defaults.BulletedListItem,
    numbered_list_item: o?.NumberedListItem ?? Defaults.NumberedListItem,
    to_do: o?.ToDo ?? Defaults.ToDo,
    toggle: o?.Toggle ?? Defaults.Toggle,
    callout: o?.Callout ?? Defaults.Callout,
    quote: o?.Quote ?? Defaults.Quote,
    code: o?.Code ?? Defaults.Code,
    equation: o?.Equation ?? Defaults.Equation,
    divider: o?.Divider ?? Defaults.Divider,
    image: o?.Image ?? Defaults.Image,
    video: o?.Video ?? Defaults.Video,
    audio: o?.Audio ?? Defaults.Audio,
    file: o?.File ?? Defaults.File,
    pdf: o?.Pdf ?? Defaults.Pdf,
    bookmark: o?.Bookmark ?? Defaults.Bookmark,
    link_preview: o?.LinkPreview ?? Defaults.LinkPreview,
    link_to_page: o?.LinkToPage ?? Defaults.LinkToPage,
    child_page: o?.ChildPage ?? Defaults.ChildPage,
    child_database: o?.ChildDatabase ?? Defaults.ChildDatabase,
    embed: o?.Embed ?? Defaults.Embed,
    table: o?.Table ?? Defaults.Table,
    table_row: o?.TableRow ?? Defaults.Unsupported,
    column_list: o?.ColumnList ?? Defaults.ColumnList,
    column: o?.Column ?? Defaults.Column,
    synced_block: o?.SyncedBlock ?? Defaults.SyncedBlock,
    breadcrumb: o?.Breadcrumb ?? Defaults.Breadcrumb,
    table_of_contents: o?.TableOfContents ?? Defaults.TableOfContents,
    tab: o?.Tab ?? Defaults.Unsupported,
    template: o?.Template ?? Defaults.Unsupported,
    meeting_notes: o?.MeetingNotes ?? Defaults.Unsupported,
    transcription: Defaults.Unsupported,
    unsupported: o?.Unsupported ?? Defaults.Unsupported,
  } satisfies Record<BlockObjectResponse["type"], unknown>;
  // 型より新しいランタイム値 (lib 未追従の Notion 新 block type) は Unsupported に倒す
  return (
    (map as Record<string, unknown>)[block.type] ??
    o?.Unsupported ??
    Defaults.Unsupported
  );
}
