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

/**
 * 実際の Notion プロパティ名。省略時はスキーマのプロパティキー自身を実名とみなす
 * （`mapProperties()` 等が `raw[def.notion ?? key]` で解決する）。
 * 日本語などスキーマキーに使えない実名は `prop.title("名前")` のように明示する。
 */
export interface TitlePropDef {
  readonly kind: "title";
  readonly notion?: string;
}
export interface RichTextPropDef {
  readonly kind: "richText";
  readonly notion?: string;
}
export interface SelectPropDef<
  Options extends readonly string[] = readonly string[],
> {
  readonly kind: "select";
  readonly options?: Options;
  readonly notion?: string;
}
export interface StatusPropDef<
  Options extends readonly string[] = readonly string[],
> {
  readonly kind: "status";
  readonly options: Options;
  readonly notion?: string;
}
export interface MultiSelectPropDef<
  Options extends readonly string[] = readonly string[],
> {
  readonly kind: "multiSelect";
  readonly options?: Options;
  readonly notion?: string;
}
export interface DatePropDef {
  readonly kind: "date";
  readonly notion?: string;
}
export interface NumberPropDef {
  readonly kind: "number";
  readonly notion?: string;
}
export interface CheckboxPropDef {
  readonly kind: "checkbox";
  readonly notion?: string;
}
export interface UrlPropDef {
  readonly kind: "url";
  readonly notion?: string;
}
export interface FormulaPropDef<
  T extends FormulaResultType = FormulaResultType,
> {
  readonly kind: "formula";
  readonly resultType: T;
  readonly notion?: string;
}
export interface RollupPropDef<T extends RollupResultType = RollupResultType> {
  readonly kind: "rollup";
  readonly resultType: T;
  readonly notion?: string;
}
export interface RelationPropDef {
  readonly kind: "relation";
  readonly targetCollection?: string;
  readonly notion?: string;
}
export interface PeoplePropDef {
  readonly kind: "people";
  readonly notion?: string;
}
export interface FilesPropDef {
  readonly kind: "files";
  readonly notion?: string;
}
export interface UniqueIdPropDef {
  readonly kind: "uniqueId";
  readonly notion?: string;
}
export interface CreatedTimePropDef {
  readonly kind: "createdTime";
  readonly notion?: string;
}
export interface LastEditedByPropDef {
  readonly kind: "lastEditedBy";
  readonly notion?: string;
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
 * プロパティ定義ビルダー。各ビルダーは末尾に実際の Notion プロパティ名を
 * 任意で受け取る（省略時はスキーマキー自身が実名とみなされる）。
 *
 * @example
 * properties: {
 *   title: prop.title(),
 *   status: prop.status(["draft", "published"] as const),
 *   tags: prop.multiSelect(),
 *   // スキーマキーが実際のNotionプロパティ名と異なる場合は明示する
 *   name: prop.title("名前"),
 *   // select/multiSelect は options が先頭の任意引数なので、
 *   // options を省略して notion だけ渡す場合は undefined を明示する
 *   author: prop.select(undefined, "著者"),
 * }
 */
export const prop = {
  title: (notion?: string): TitlePropDef => ({ kind: "title", notion }),
  richText: (notion?: string): RichTextPropDef => ({
    kind: "richText",
    notion,
  }),
  select: <const Options extends readonly string[]>(
    options?: Options,
    notion?: string,
  ): SelectPropDef<Options> => ({
    kind: "select",
    options,
    notion,
  }),
  status: <const Options extends readonly string[]>(
    options: Options,
    notion?: string,
  ): StatusPropDef<Options> => ({
    kind: "status",
    options,
    notion,
  }),
  multiSelect: <const Options extends readonly string[]>(
    options?: Options,
    notion?: string,
  ): MultiSelectPropDef<Options> => ({
    kind: "multiSelect",
    options,
    notion,
  }),
  date: (notion?: string): DatePropDef => ({ kind: "date", notion }),
  number: (notion?: string): NumberPropDef => ({ kind: "number", notion }),
  checkbox: (notion?: string): CheckboxPropDef => ({
    kind: "checkbox",
    notion,
  }),
  url: (notion?: string): UrlPropDef => ({ kind: "url", notion }),
  formula: <const T extends FormulaResultType>(
    resultType: T,
    notion?: string,
  ): FormulaPropDef<T> => ({
    kind: "formula",
    resultType,
    notion,
  }),
  rollup: <const T extends RollupResultType>(
    resultType: T,
    notion?: string,
  ): RollupPropDef<T> => ({
    kind: "rollup",
    resultType,
    notion,
  }),
  relation: (targetCollection?: string, notion?: string): RelationPropDef => ({
    kind: "relation",
    targetCollection,
    notion,
  }),
  people: (notion?: string): PeoplePropDef => ({ kind: "people", notion }),
  files: (notion?: string): FilesPropDef => ({ kind: "files", notion }),
  uniqueId: (notion?: string): UniqueIdPropDef => ({
    kind: "uniqueId",
    notion,
  }),
  createdTime: (notion?: string): CreatedTimePropDef => ({
    kind: "createdTime",
    notion,
  }),
  lastEditedBy: (notion?: string): LastEditedByPropDef => ({
    kind: "lastEditedBy",
    notion,
  }),
} as const;
