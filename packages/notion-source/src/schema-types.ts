import type { PropertyDef, PropertyMap } from "@notion-headless-cms/core";
import type {
  BaseContentItem,
  CollectionDef,
  DataCollectionDef,
} from "@notion-headless-cms/core/source-author";

/** ページコレクションのスキーマエントリ。URL ルーティングする記事・固定ページ向け。 */
export interface PageCollectionSchemaEntry {
  /** コレクション種別。省略時はページ。 */
  kind?: "page";
  dataSourceId: string;
  properties: PropertyMap;
  /** slug として使う TS フィールド名。 */
  slugField: string;
  statusField?: string;
}

/** 要素（データ）コレクションのスキーマエントリ。URL を持たない単純データ向け。 */
export interface DataCollectionSchemaEntry {
  kind: "data";
  dataSourceId: string;
  properties: PropertyMap;
  statusField?: string;
}

/** 1 コレクション分のスキーマエントリ。CLI が `nhc.schema.ts` に出力する。 */
export type CollectionSchemaEntry =
  | PageCollectionSchemaEntry
  | DataCollectionSchemaEntry;

/** 全コレクションのスキーママップ。`schema` のトップレベル型。 */
export type SchemaMap = Record<string, CollectionSchemaEntry>;

type TSTypeForPropDef<P extends PropertyDef> = P["type"] extends "checkbox"
  ? boolean
  : P["type"] extends "number"
    ? number | null
    : P["type"] extends "multiSelect"
      ? string[]
      : P["type"] extends "status"
        ? P extends { options: readonly (infer O extends string)[] }
          ? O | null
          : string | null
        : string | null;

type ItemFromPropertyMap<PM extends PropertyMap> = {
  [K in keyof PM]: TSTypeForPropDef<PM[K]>;
};

/**
 * スキーマエントリから 1 アイテムの型を導出する。
 * - ページ: slugField を null 非許容の string に絞る。
 * - 要素（`kind: "data"`）: slug を型から除去し、URL を持たないデータとして扱う。
 */
export type CMSItemFromSchema<E extends CollectionSchemaEntry> = E extends {
  kind: "data";
}
  ? Omit<BaseContentItem, "slug"> & ItemFromPropertyMap<E["properties"]>
  : E extends PageCollectionSchemaEntry
    ? BaseContentItem &
        Omit<ItemFromPropertyMap<E["properties"]>, E["slugField"]> &
        Record<E["slugField"], string>
    : never;

/** SchemaMap から `CollectionsConfig` の型を導出する。要素は `DataCollectionDef`。 */
export type CollectionsFromSchema<S extends SchemaMap> = {
  [K in keyof S]: S[K] extends { kind: "data" }
    ? DataCollectionDef<CMSItemFromSchema<S[K]>>
    : CollectionDef<CMSItemFromSchema<S[K]>>;
};
