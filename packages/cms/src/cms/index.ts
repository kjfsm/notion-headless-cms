export type {
  CMS,
  CMSSyncControls,
  CMSSyncDelegate,
  CollectionEntrySnapshot,
  CollectionHandle,
  CollectionIndexEntry,
  CreateCMSNotionOptions,
  CreateCMSOptions,
  CreateCMSOptions as CreateContentCMSOptions,
  CreateCMSStoresOptions,
  CreateCMSSyncOptions,
} from "./create-cms.js";
/**
 * `createCMS`(本パッケージ、v3)の別名。`@notion-headless-cms/client`(v2)にも
 * 引数・戻り値が別物の同名 `createCMS` が存在し import 元を取り違えやすいため、
 * 明示的に区別したい場合に使う(README「30 秒で動かす」節の注記も参照)。
 */
export { createCMS, createCMS as createContentCMS } from "./create-cms.js";
