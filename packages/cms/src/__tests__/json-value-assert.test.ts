import { describe, expectTypeOf, it } from "vitest";

import type { IndexEntry } from "../types/collection-index.js";
import type { EntrySnapshot } from "../types/entry-snapshot.js";
import type { AssertJsonValue, ExpectTrue, IsJsonValue } from "../types/json-value.js";
import type { ListResult } from "../types/query.js";

type Snapshot = EntrySnapshot<{ title: string }>;

interface NotSerializable {
  readonly fetchMore: () => Promise<void>;
}

describe("JsonValue 互換性の型テスト", () => {
  it("EntrySnapshot / IndexEntry / ListResult は JsonValue 互換(AssertJsonValue で元の型のまま通る)", () => {
    expectTypeOf<AssertJsonValue<Snapshot>>().toEqualTypeOf<Snapshot>();
    expectTypeOf<AssertJsonValue<IndexEntry>>().toEqualTypeOf<IndexEntry>();
    type ListOfMeta = ListResult<{ slug: string; title: string }>;
    expectTypeOf<AssertJsonValue<ListOfMeta>>().toEqualTypeOf<ListOfMeta>();
  });

  it("関数プロパティを持つ型は IsJsonValue が false になる", () => {
    type _check = ExpectTrue<IsJsonValue<NotSerializable> extends false ? true : never>;
    expectTypeOf<IsJsonValue<NotSerializable>>().toEqualTypeOf<false>();
  });

  it("関数を含む型を AssertJsonValue に通すと never になる(コンパイルエラーとして検出可能)", () => {
    // NotSerializable のまま素通りしていれば never にはならない。この等価判定自体が
    // 「関数を含む公開戻り値型を書くとコンパイルエラーになる」ことの型テストになる。
    expectTypeOf<AssertJsonValue<NotSerializable>>().toEqualTypeOf<never>();
  });
});
