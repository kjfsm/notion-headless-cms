/**
 * Notion プロパティ型を TypeScript ファーストで定義するビルダー群 (`prop`)。
 * `defineCollection` の `properties` に渡すと、エントリ型が推論される。
 *
 * v2 の CLI codegen (9 型のみ対応) を置き換え、formula / rollup / relation /
 * people / files / uniqueId / createdTime / lastEditedBy を追加で網羅する。
 * 未知のプロパティ型は `unsupported()` として型に現す（黙ってスキップしない）。
 */

export type FormulaResultType = "string" | "number" | "boolean" | "date";
export type RollupResultType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "array";

export interface TitlePropDef {
  readonly kind: "title";
}
export interface RichTextPropDef {
  readonly kind: "richText";
}
export interface SelectPropDef<
  Options extends readonly string[] = readonly string[],
> {
  readonly kind: "select";
  readonly options?: Options;
}
export interface StatusPropDef<
  Options extends readonly string[] = readonly string[],
> {
  readonly kind: "status";
  readonly options: Options;
}
export interface MultiSelectPropDef<
  Options extends readonly string[] = readonly string[],
> {
  readonly kind: "multiSelect";
  readonly options?: Options;
}
export interface DatePropDef {
  readonly kind: "date";
}
export interface NumberPropDef {
  readonly kind: "number";
}
export interface CheckboxPropDef {
  readonly kind: "checkbox";
}
export interface UrlPropDef {
  readonly kind: "url";
}
export interface FormulaPropDef<
  T extends FormulaResultType = FormulaResultType,
> {
  readonly kind: "formula";
  readonly resultType: T;
}
export interface RollupPropDef<T extends RollupResultType = RollupResultType> {
  readonly kind: "rollup";
  readonly resultType: T;
}
export interface RelationPropDef {
  readonly kind: "relation";
  readonly targetCollection?: string;
}
export interface PeoplePropDef {
  readonly kind: "people";
}
export interface FilesPropDef {
  readonly kind: "files";
}
export interface UniqueIdPropDef {
  readonly kind: "uniqueId";
}
export interface CreatedTimePropDef {
  readonly kind: "createdTime";
}
export interface LastEditedByPropDef {
  readonly kind: "lastEditedBy";
}

export type PropDef =
  | TitlePropDef
  | RichTextPropDef
  | SelectPropDef
  | StatusPropDef
  | MultiSelectPropDef
  | DatePropDef
  | NumberPropDef
  | CheckboxPropDef
  | UrlPropDef
  | FormulaPropDef
  | RollupPropDef
  | RelationPropDef
  | PeoplePropDef
  | FilesPropDef
  | UniqueIdPropDef
  | CreatedTimePropDef
  | LastEditedByPropDef;

export type PropertyMap = Record<string, PropDef>;

export interface PersonValue {
  readonly id: string;
  readonly name: string | null;
  readonly avatarUrl: string | null;
}

export interface FileValue {
  readonly name: string;
  /** 同期パイプライン (#439) がハッシュキー付きプロキシ URL に解決する。S1 時点では素の URL。 */
  readonly url: string;
}

export interface UniqueIdValue {
  readonly prefix: string | null;
  readonly number: number;
}

/** 未知のプロパティ型を黙ってスキップせず、型に残す（v2 の反省）。 */
export interface UnsupportedValue {
  readonly type: "unsupported";
  readonly raw: unknown;
}

/** formula/rollup の結果型リテラルから TS 値型を導出する。 */
type ResultTypeValue<T extends string> = T extends "string"
  ? string | null
  : T extends "number"
    ? number | null
    : T extends "boolean"
      ? boolean
      : T extends "date"
        ? string | null
        : T extends "array"
          ? JsonPrimitiveArray
          : never;

type JsonPrimitiveArray = readonly (string | number | boolean | null)[];

/** `PropDef` から実際にエントリへ載る TypeScript の値型を導出する。 */
export type InferPropValue<D extends PropDef> = D extends TitlePropDef
  ? string
  : D extends RichTextPropDef
    ? string
    : D extends SelectPropDef<infer Options>
      ? (Options extends readonly string[] ? Options[number] : string) | null
      : D extends StatusPropDef<infer Options>
        ? Options[number]
        : D extends MultiSelectPropDef<infer Options>
          ? readonly (Options extends readonly string[]
              ? Options[number]
              : string)[]
          : D extends DatePropDef
            ? string | null
            : D extends NumberPropDef
              ? number | null
              : D extends CheckboxPropDef
                ? boolean
                : D extends UrlPropDef
                  ? string | null
                  : D extends FormulaPropDef<infer T>
                    ? ResultTypeValue<T>
                    : D extends RollupPropDef<infer T>
                      ? ResultTypeValue<T>
                      : D extends RelationPropDef
                        ? readonly string[]
                        : D extends PeoplePropDef
                          ? readonly PersonValue[]
                          : D extends FilesPropDef
                            ? readonly FileValue[]
                            : D extends UniqueIdPropDef
                              ? UniqueIdValue
                              : D extends CreatedTimePropDef
                                ? string
                                : D extends LastEditedByPropDef
                                  ? PersonValue
                                  : UnsupportedValue;

/**
 * プロパティ定義ビルダー。
 *
 * @example
 * properties: {
 *   title: prop.title(),
 *   status: prop.status(["draft", "published"] as const),
 *   tags: prop.multiSelect(),
 * }
 */
export const prop = {
  title: (): TitlePropDef => ({ kind: "title" }),
  richText: (): RichTextPropDef => ({ kind: "richText" }),
  select: <const Options extends readonly string[]>(
    options?: Options,
  ): SelectPropDef<Options> => ({
    kind: "select",
    options,
  }),
  status: <const Options extends readonly string[]>(
    options: Options,
  ): StatusPropDef<Options> => ({
    kind: "status",
    options,
  }),
  multiSelect: <const Options extends readonly string[]>(
    options?: Options,
  ): MultiSelectPropDef<Options> => ({
    kind: "multiSelect",
    options,
  }),
  date: (): DatePropDef => ({ kind: "date" }),
  number: (): NumberPropDef => ({ kind: "number" }),
  checkbox: (): CheckboxPropDef => ({ kind: "checkbox" }),
  url: (): UrlPropDef => ({ kind: "url" }),
  formula: <const T extends FormulaResultType>(
    resultType: T,
  ): FormulaPropDef<T> => ({
    kind: "formula",
    resultType,
  }),
  rollup: <const T extends RollupResultType>(
    resultType: T,
  ): RollupPropDef<T> => ({
    kind: "rollup",
    resultType,
  }),
  relation: (targetCollection?: string): RelationPropDef => ({
    kind: "relation",
    targetCollection,
  }),
  people: (): PeoplePropDef => ({ kind: "people" }),
  files: (): FilesPropDef => ({ kind: "files" }),
  uniqueId: (): UniqueIdPropDef => ({ kind: "uniqueId" }),
  createdTime: (): CreatedTimePropDef => ({ kind: "createdTime" }),
  lastEditedBy: (): LastEditedByPropDef => ({ kind: "lastEditedBy" }),
} as const;
