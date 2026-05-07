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
 * `className` は `<NotionRenderer classNames={{ ... }} />` 経由で型ごとに上書きされる。
 */
export interface BlockComponentProps<
  T extends BlockObjectResponse = BlockObjectResponse,
> {
  block: T & { children?: NotionBlock[] };
  renderChildren?: (children: NotionBlock[]) => ReactNode;
  className?: string;
}

/** `NotionRenderer.classNames` のマップ。block.type ごとにルート要素の追加クラスを差し込める。 */
export type BlockClassNames = Partial<
  Record<BlockObjectResponse["type"], string>
>;

/**
 * NotionRenderer の `components` プロップ。
 * 任意のブロックコンポーネントを差し替えられる。
 *
 * Heading は heading_1 / heading_2 / heading_3 / heading_4 を共通で受け持つ。
 * TableRow / Tab / Template / MeetingNotes / Transcription はデフォルト実装が
 * 用意されておらず Unsupported にフォールバックされるが、
 * BlockObjectResponse union と網羅性を一致させるため override スロットは提供する。
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
  TableRow?: ComponentType<BlockComponentProps>;
  ColumnList?: ComponentType<BlockComponentProps>;
  Column?: ComponentType<BlockComponentProps>;
  SyncedBlock?: ComponentType<BlockComponentProps>;
  Breadcrumb?: ComponentType<BlockComponentProps>;
  TableOfContents?: ComponentType<BlockComponentProps>;
  Tab?: ComponentType<BlockComponentProps>;
  Template?: ComponentType<BlockComponentProps>;
  MeetingNotes?: ComponentType<BlockComponentProps>;
  Transcription?: ComponentType<BlockComponentProps>;
  Unsupported?: ComponentType<BlockComponentProps>;
}

export interface NotionRendererProps {
  blocks: NotionBlock[];
  components?: ComponentOverrides;
  className?: string;
  /** block.type ごとにルート要素へ追加クラスを差し込む（tailwind-merge で衝突解決）。 */
  classNames?: BlockClassNames;
}
