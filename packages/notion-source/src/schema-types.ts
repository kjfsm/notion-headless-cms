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

type TSTypeForPropType<T extends PropertyDef["type"]> = T extends "checkbox"
  ? boolean
  : T extends "number"
    ? number | null
    : T extends "multiSelect"
      ? string[]
      : string | null;

type ItemFromPropertyMap<PM extends PropertyMap> = {
  [K in keyof PM]: TSTypeForPropType<PM[K]["type"]>;
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
