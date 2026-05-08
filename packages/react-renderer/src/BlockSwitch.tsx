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

// 各ブロック型ごとに固有プロップ型を持つコンポーネントを単一の Switch で扱うため、
// 型整合は block.type による narrowing で保証し、
// React 要素を作る側ではプロップを共通形にキャストする。
type AnyBlockComponent = ComponentType<BlockComponentProps>;

/** type で対応する Block コンポーネントを引き当てて描画する。components / classNames は Context から取得。 */
export function BlockSwitch({ block }: BlockSwitchProps) {
  const { components, classNames } = useNotionContext();
  const C = pickComponent(block, components) as AnyBlockComponent;
  return <C block={block} className={classNames?.[block.type]} />;
}

// `satisfies Record<BlockObjectResponse["type"], unknown>` により、
// `@notionhq/client` 側で BlockObjectResponse union に新しい block type が
// 追加された場合は型エラーになる (= ライブラリ更新検知)。
// 自前の type-test ファイルを置かずに、@notionhq/client の型を直接用いて
// 網羅性を保証する仕組み。
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
  // 実行時に未知の type (型では現れないがランタイムで Notion API が返した新 type) は
  // Unsupported にフォールバック。型チェックは satisfies で別途網羅性を保証している。
  return (
    (map as Record<string, unknown>)[block.type] ??
    o?.Unsupported ??
    Defaults.Unsupported
  );
}
