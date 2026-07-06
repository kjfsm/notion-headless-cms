import type { PropDef, PropertyMap } from "./property.js";

interface TextOperators {
  equals?: string;
  contains?: string;
  startsWith?: string;
  isEmpty?: boolean;
}
interface SelectOperators {
  equals?: string;
  in?: readonly string[];
}
interface MultiSelectOperators {
  has?: string;
  hasAny?: readonly string[];
  hasAll?: readonly string[];
}
interface DateOperators {
  equals?: string;
  before?: string;
  after?: string;
  onOrBefore?: string;
  onOrAfter?: string;
}
interface NumberOperators {
  equals?: number;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
}
interface CheckboxOperators {
  equals?: boolean;
}

/**
 * プロパティ型から使える where 演算子を導出する。
 * formula/rollup/relation/people/files/uniqueId は S1 時点では演算子を持たない
 * （型に合わない演算子はコンパイルエラーにするという設計上、未対応の型は
 * `WhereInput` のキーから丸ごと消える）。
 */
export type OperatorsForProp<D extends PropDef> = D extends {
  kind: "title" | "richText" | "url";
}
  ? TextOperators
  : D extends { kind: "select" | "status" }
    ? SelectOperators
    : D extends { kind: "multiSelect" }
      ? MultiSelectOperators
      : D extends { kind: "date" | "createdTime" }
        ? DateOperators
        : D extends { kind: "number" }
          ? NumberOperators
          : D extends { kind: "checkbox" }
            ? CheckboxOperators
            : never;

type QueryableKeys<P extends PropertyMap> = {
  [K in keyof P]: OperatorsForProp<P[K]> extends never ? never : K;
}[keyof P];

export type WhereInput<P extends PropertyMap> = {
  [K in QueryableKeys<P>]?: OperatorsForProp<P[K]>;
};

export type SortDirection = "asc" | "desc";

export interface SortInput<P extends PropertyMap> {
  readonly by: QueryableKeys<P>;
  readonly direction: SortDirection;
}

export interface ListParams<P extends PropertyMap> {
  readonly where?: WhereInput<P>;
  readonly sort?: readonly SortInput<P>[];
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ListResult<Item> {
  readonly items: readonly Item[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  /** `where` 適用後・ページング前の総件数(ページャ UI の件数表示用)。 */
  readonly total: number;
}
