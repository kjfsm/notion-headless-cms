import type {
  BaseContentItem,
  CollectionDef,
  PropertyDef,
  PropertyMap,
} from "@notion-headless-cms/core";

/** 1 コレクション分のスキーマエントリ。CLI が `nhc.schema.ts` に出力する。 */
export interface CollectionSchemaEntry {
  dataSourceId: string;
  properties: PropertyMap;
  slugField: string;
  statusField?: string;
}

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

/** スキーマエントリから 1 アイテムの型を導出する。slugField は null 非許容。 */
export type CMSItemFromSchema<E extends CollectionSchemaEntry> =
  BaseContentItem &
    Omit<ItemFromPropertyMap<E["properties"]>, E["slugField"]> &
    Record<E["slugField"], string>;

/** SchemaMap から `CollectionsConfig` の型を導出する。 */
export type CollectionsFromSchema<S extends SchemaMap> = {
  [K in keyof S]: CollectionDef<CMSItemFromSchema<S[K]>>;
};
