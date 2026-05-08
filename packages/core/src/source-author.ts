/**
 * データソースアダプター実装者向けの型エクスポート。
 * 通常の CMS 利用者はこのサブパスを import しない。
 *
 * @example
 * import type { CMSAdapter, CMSSources, CollectionDef } from "@notion-headless-cms/core/source-author";
 *
 * declare module "@notion-headless-cms/core" {
 *   interface CMSSources {
 *     mySource?: CMSAdapter;
 *   }
 * }
 */
export type {
  CollectionDef,
  CollectionsConfig,
  InferCollectionItem,
} from "./types/config";
export type { BaseContentItem } from "./types/content";
export type {
  CMSAdapter,
  CMSSources,
  MergeSourceCollections,
} from "./types/sources";
