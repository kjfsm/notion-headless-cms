import { CMSError } from "../errors.js";
import type { InferPropValue, PropertyMap, StatusPropDef } from "./property.js";

/** `properties` の中から status 型のプロパティキーだけを抽出する。 */
type StatusPropertyKeys<P extends PropertyMap> = {
  [K in keyof P]: P[K] extends StatusPropDef ? K : never;
}[keyof P];

/** status プロパティの options リテラルを取り出す（`published`/`accessible` の型を絞るため）。 */
type StatusOptionsOf<P extends PropertyMap, K extends keyof P> =
  P[K] extends StatusPropDef<infer Options> ? Options[number] : never;

export interface CollectionConfig<
  P extends PropertyMap,
  StatusKey extends StatusPropertyKeys<P> = never,
> {
  /** Notion の data_source_id（multi-source database に対応するための固定単位）。 */
  readonly dataSourceId: string;
  /**
   * URL slug として使うプロパティキー。
   * slug 列を持たない設定値コレクション（選択肢リスト等）では省略でき、
   * その場合エントリは Notion の page id でアドレスされる（どのプロパティにも一意性を要求しない）。
   */
  readonly slug?: keyof P;
  readonly properties: P;
  /** list 対象を判定する status プロパティと、公開扱いにする値。省略時は常に公開。 */
  readonly statusProperty?: StatusKey;
  readonly published?: readonly StatusOptionsOf<P, StatusKey>[];
  /** find は許可するが list からは隠す値（限定公開）。省略時は published と同じ。 */
  readonly accessible?: readonly StatusOptionsOf<P, StatusKey>[];
}

export interface CollectionDef<P extends PropertyMap = PropertyMap> {
  readonly dataSourceId: string;
  /** 省略時はエントリを page id でアドレスする（`CollectionConfig.slug` 参照）。 */
  readonly slug?: keyof P;
  readonly properties: P;
  readonly statusProperty?: keyof P;
  readonly published?: readonly string[];
  readonly accessible?: readonly string[];
}

/** システムメタデータ（Notion が自動セットするフィールド）。全コレクション共通。 */
export interface EntrySystemMeta {
  readonly id: string;
  readonly slug: string;
  /** `last_edited_time`。version スタンプとしても使う。 */
  readonly lastEditedTime: string;
}

export type InferEntry<C> =
  C extends CollectionDef<infer P>
    ? EntrySystemMeta & { readonly [K in keyof P]: InferPropValue<P[K]> }
    : never;

/**
 * コレクションを定義する。`published`/`accessible` を指定する場合は
 * `statusProperty` が必須（「設定が黙って無視される経路を作らない」— #437 の設計判断）。
 */
export function defineCollection<
  const P extends PropertyMap,
  const StatusKey extends StatusPropertyKeys<P> = never,
>(config: CollectionConfig<P, StatusKey>): CollectionDef<P> {
  if ((config.published || config.accessible) && !config.statusProperty) {
    throw new CMSError({
      code: "schema/status_property_required",
      message: "published/accessible を指定する場合は statusProperty の指定が必須です",
      context: { operation: "defineCollection" },
    });
  }
  const statusDef = config.statusProperty ? config.properties[config.statusProperty] : undefined;
  if (statusDef && statusDef.kind !== "status") {
    throw new CMSError({
      code: "schema/status_property_required",
      message: `statusProperty "${String(config.statusProperty)}" は status 型のプロパティではありません`,
      context: { operation: "defineCollection" },
    });
  }
  return {
    dataSourceId: config.dataSourceId,
    slug: config.slug,
    properties: config.properties,
    statusProperty: config.statusProperty as keyof P | undefined,
    published: config.published as readonly string[] | undefined,
    accessible: config.accessible as readonly string[] | undefined,
  };
}

// biome-ignore lint/suspicious/noExplicitAny: 「何らかの CollectionDef」を表す型消去用途（tRPC の AnyRouter 等と同じ意図）。
export type CollectionMap = Record<string, CollectionDef<any>>;

export interface SchemaDef<C extends CollectionMap = CollectionMap> {
  readonly collections: C;
}

/** `defineCollection` で作った複数のコレクションを 1 つのスキーマにまとめる。 */
export function defineSchema<const C extends CollectionMap>(collections: C): SchemaDef<C> {
  return { collections };
}

export type InferSchemaEntries<S> =
  S extends SchemaDef<infer C> ? { [K in keyof C]: InferEntry<C[K]> } : never;
