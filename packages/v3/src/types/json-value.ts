/**
 * loader / RSC / KV 保存の境界をすべて素通りできる、完全にシリアライズ可能な値。
 * 関数・クラスインスタンス・循環参照は含めない（v2 の `notionBlocks()` の反省）。
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { [key: string]: JsonValue };

type Primitive = string | number | boolean | null | undefined;

/** 再帰の深さを制限するためのデクリメント表（`NormalizedBlock` のような自己参照型が無限再帰するのを防ぐ）。 */
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8];

/**
 * `T` が JSON シリアライズ可能かどうかを型レベルで判定する。
 *
 * 素朴に `T extends JsonValue` と書くと、TypeScript が「明示的な index signature を
 * 持たないインターフェースは index signature 付きの型に代入できない」という制約により、
 * 通常のオブジェクト型（`EntrySnapshot` 等）が軒並み `JsonValue` を満たさないと判定されて
 * しまう（TS の既知の挙動）。`keyof T` を辿って各プロパティを個別に判定することで、
 * この制約を経由せずに構造を検査する。深さは `D` で打ち切り、自己参照型（`NormalizedBlock`
 * の `children`）でも型チェッカーが無限再帰しないようにする。
 */
export type IsJsonValue<T, D extends number = 8> = D extends never
  ? true
  : T extends Primitive
    ? true
    : T extends readonly (infer U)[]
      ? IsJsonValue<U, Prev[D]>
      : T extends (...args: never[]) => unknown
        ? false
        : T extends object
          ? { [K in keyof T]: IsJsonValue<T[K], Prev[D]> }[keyof T] extends
              | true
              | never
              | undefined
            ? true
            : false
          : false;

/**
 * `T` が `JsonValue` 互換であることを型レベルで固定する。
 * 公開戻り値型に関数・クラスインスタンスが紛れ込むと `never` になり、
 * `expectTypeOf(...).toEqualTypeOf<T>()` で元の型と一致しなくなる
 * （型テストとして使う。実行時チェックではない）。
 *
 * @example
 * type _assert = AssertJsonValue<EntrySnapshot>;
 */
export type AssertJsonValue<T> = IsJsonValue<T> extends true ? T : never;

/** `IsJsonValue<T>` が `true` であることをコンパイルエラーとして固定するための補助型。 */
export type ExpectTrue<T extends true> = T;
