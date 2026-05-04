import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { ComponentType, ReactNode } from "react";

export type { BlockObjectResponse };

/** children を再帰解決済みのブロック木。`fetchBlockTree` が返す形式と一致。 */
export type NotionBlock = BlockObjectResponse & {
  children?: NotionBlock[];
};

/**
 * 各 block コンポーネントの共通プロップ。
 * children 描画時の再帰のため `renderChildren` を渡す。
 */
export interface BlockComponentProps<
  T extends BlockObjectResponse = BlockObjectResponse,
> {
  block: T & { children?: NotionBlock[] };
  renderChildren?: (children: NotionBlock[]) => ReactNode;
}

/**
 * NotionRenderer の `components` プロップ。
 * 任意のブロックコンポーネントを差し替えられる。
 */
export interface ComponentOverrides {
  Paragraph?: ComponentType<BlockComponentProps>;
  Heading?: ComponentType<BlockComponentProps>;
  BulletedListItem?: ComponentType<BlockComponentProps>;
  NumberedListItem?: ComponentType<BlockComponentProps>;
  ToDo?: ComponentType<BlockComponentProps>;
  Toggle?: ComponentType<BlockComponentProps>;
  Callout?: ComponentType<BlockComponentProps>;
  Quote?: ComponentType<BlockComponentProps>;
  Code?: ComponentType<BlockComponentProps>;
  Equation?: ComponentType<BlockComponentProps>;
  Divider?: ComponentType<BlockComponentProps>;
  Image?: ComponentType<BlockComponentProps>;
  Video?: ComponentType<BlockComponentProps>;
  Audio?: ComponentType<BlockComponentProps>;
  File?: ComponentType<BlockComponentProps>;
  Pdf?: ComponentType<BlockComponentProps>;
  Bookmark?: ComponentType<BlockComponentProps>;
  LinkPreview?: ComponentType<BlockComponentProps>;
  LinkToPage?: ComponentType<BlockComponentProps>;
  ChildPage?: ComponentType<BlockComponentProps>;
  ChildDatabase?: ComponentType<BlockComponentProps>;
  Embed?: ComponentType<BlockComponentProps>;
  Table?: ComponentType<BlockComponentProps>;
  ColumnList?: ComponentType<BlockComponentProps>;
  Column?: ComponentType<BlockComponentProps>;
  SyncedBlock?: ComponentType<BlockComponentProps>;
  Breadcrumb?: ComponentType<BlockComponentProps>;
  TableOfContents?: ComponentType<BlockComponentProps>;
  Unsupported?: ComponentType<BlockComponentProps>;
}

export interface NotionRendererProps {
  blocks: NotionBlock[];
  components?: ComponentOverrides;
  className?: string;
}
