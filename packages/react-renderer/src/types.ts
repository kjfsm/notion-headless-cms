import type {
  AudioBlockObjectResponse,
  BlockObjectResponse,
  BookmarkBlockObjectResponse,
  BreadcrumbBlockObjectResponse,
  BulletedListItemBlockObjectResponse,
  CalloutBlockObjectResponse,
  ChildDatabaseBlockObjectResponse,
  ChildPageBlockObjectResponse,
  CodeBlockObjectResponse,
  ColumnBlockObjectResponse,
  ColumnListBlockObjectResponse,
  DividerBlockObjectResponse,
  EmbedBlockObjectResponse,
  EquationBlockObjectResponse,
  FileBlockObjectResponse,
  Heading1BlockObjectResponse,
  Heading2BlockObjectResponse,
  Heading3BlockObjectResponse,
  Heading4BlockObjectResponse,
  ImageBlockObjectResponse,
  LinkPreviewBlockObjectResponse,
  LinkToPageBlockObjectResponse,
  MeetingNotesBlockObjectResponse,
  NumberedListItemBlockObjectResponse,
  ParagraphBlockObjectResponse,
  PdfBlockObjectResponse,
  QuoteBlockObjectResponse,
  SyncedBlockBlockObjectResponse,
  TabBlockObjectResponse,
  TableBlockObjectResponse,
  TableOfContentsBlockObjectResponse,
  TableRowBlockObjectResponse,
  TemplateBlockObjectResponse,
  ToDoBlockObjectResponse,
  ToggleBlockObjectResponse,
  VideoBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { ComponentType } from "react";

export type { BlockObjectResponse };

/** children を再帰解決済みのブロック木。`fetchBlockTree` が返す形式と一致。 */
export type NotionBlock = BlockObjectResponse & {
  children?: NotionBlock[];
};

/**
 * 各 block コンポーネントの共通プロップ。
 * 子ブロードの描画は Context 経由の `<NotionBlocks>` が担うため、
 * renderChildren は不要になった（Context 化 #217 で廃止）。
 */
export interface BlockComponentProps<
  T extends BlockObjectResponse = BlockObjectResponse,
> {
  block: T & { children?: NotionBlock[] };
  className?: string;
}

/** `NotionRenderer.classNames` のマップ。block.type ごとにルート要素の追加クラスを差し込める。 */
export type BlockClassNames = Partial<
  Record<BlockObjectResponse["type"], string>
>;

/** heading_1 / heading_2 / heading_3 / heading_4 を共通で受け持つ型。 */
export type HeadingBlockObjectResponse =
  | Heading1BlockObjectResponse
  | Heading2BlockObjectResponse
  | Heading3BlockObjectResponse
  | Heading4BlockObjectResponse;

/**
 * NotionRenderer の `components` プロップ。
 * 任意のブロックコンポーネントを差し替えられる。
 * 各スロットは block 固有の型を受けるため、as キャスト不要で差し込める。
 *
 * Heading は heading_1 / heading_2 / heading_3 / heading_4 を共通で受け持つ。
 * TableRow / Tab / Template / MeetingNotes はデフォルト実装が
 * 用意されておらず Unsupported にフォールバックされるが、
 * BlockObjectResponse union と網羅性を一致させるため override スロットは提供する。
 */
export interface ComponentOverrides {
  Paragraph?: ComponentType<BlockComponentProps<ParagraphBlockObjectResponse>>;
  Heading?: ComponentType<BlockComponentProps<HeadingBlockObjectResponse>>;
  BulletedListItem?: ComponentType<
    BlockComponentProps<BulletedListItemBlockObjectResponse>
  >;
  NumberedListItem?: ComponentType<
    BlockComponentProps<NumberedListItemBlockObjectResponse>
  >;
  ToDo?: ComponentType<BlockComponentProps<ToDoBlockObjectResponse>>;
  Toggle?: ComponentType<BlockComponentProps<ToggleBlockObjectResponse>>;
  Callout?: ComponentType<BlockComponentProps<CalloutBlockObjectResponse>>;
  Quote?: ComponentType<BlockComponentProps<QuoteBlockObjectResponse>>;
  Code?: ComponentType<BlockComponentProps<CodeBlockObjectResponse>>;
  Equation?: ComponentType<BlockComponentProps<EquationBlockObjectResponse>>;
  Divider?: ComponentType<BlockComponentProps<DividerBlockObjectResponse>>;
  Image?: ComponentType<BlockComponentProps<ImageBlockObjectResponse>>;
  Video?: ComponentType<BlockComponentProps<VideoBlockObjectResponse>>;
  Audio?: ComponentType<BlockComponentProps<AudioBlockObjectResponse>>;
  File?: ComponentType<BlockComponentProps<FileBlockObjectResponse>>;
  Pdf?: ComponentType<BlockComponentProps<PdfBlockObjectResponse>>;
  Bookmark?: ComponentType<BlockComponentProps<BookmarkBlockObjectResponse>>;
  LinkPreview?: ComponentType<
    BlockComponentProps<LinkPreviewBlockObjectResponse>
  >;
  LinkToPage?: ComponentType<
    BlockComponentProps<LinkToPageBlockObjectResponse>
  >;
  ChildPage?: ComponentType<BlockComponentProps<ChildPageBlockObjectResponse>>;
  ChildDatabase?: ComponentType<
    BlockComponentProps<ChildDatabaseBlockObjectResponse>
  >;
  Embed?: ComponentType<BlockComponentProps<EmbedBlockObjectResponse>>;
  Table?: ComponentType<BlockComponentProps<TableBlockObjectResponse>>;
  TableRow?: ComponentType<BlockComponentProps<TableRowBlockObjectResponse>>;
  ColumnList?: ComponentType<
    BlockComponentProps<ColumnListBlockObjectResponse>
  >;
  Column?: ComponentType<BlockComponentProps<ColumnBlockObjectResponse>>;
  SyncedBlock?: ComponentType<
    BlockComponentProps<SyncedBlockBlockObjectResponse>
  >;
  Breadcrumb?: ComponentType<
    BlockComponentProps<BreadcrumbBlockObjectResponse>
  >;
  TableOfContents?: ComponentType<
    BlockComponentProps<TableOfContentsBlockObjectResponse>
  >;
  Tab?: ComponentType<BlockComponentProps<TabBlockObjectResponse>>;
  Template?: ComponentType<BlockComponentProps<TemplateBlockObjectResponse>>;
  MeetingNotes?: ComponentType<
    BlockComponentProps<MeetingNotesBlockObjectResponse>
  >;
  Unsupported?: ComponentType<BlockComponentProps>;
}

export interface NotionRendererProps {
  blocks: NotionBlock[];
  components?: ComponentOverrides;
  className?: string;
  /** block.type ごとにルート要素へ追加クラスを差し込む（tailwind-merge で衝突解決）。 */
  classNames?: BlockClassNames;
}
