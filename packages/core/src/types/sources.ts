import type { CollectionsConfig } from "./config";

/**
 * CMS データソースアダプターのインターフェース。
 * 各アダプターパッケージ (`@notion-headless-cms/notion-source` 等) が実装し、
 * `createClient({ sources: { ... } })` に渡される。
 */
export interface CMSAdapter<C extends CollectionsConfig = CollectionsConfig> {
  readonly collections: C;
}

/**
 * アダプターパッケージが宣言マージで拡張する空インターフェース。
 * import するだけでキーが補完候補に現れる (Fastify プラグインと同じパターン)。
 *
 * @example
 * declare module "@notion-headless-cms/core" {
 *   interface CMSSources {
 *     notion?: CMSAdapter;
 *   }
 * }
 */
// biome-ignore lint/suspicious/noEmptyInterface: 宣言マージの拡張ポイントとして空のまま公開する
export interface CMSSources {}

type UnionToIntersection<U> = (
  U extends unknown
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;

/** 全ソースの collections を交差型でマージする。 */
export type MergeSourceCollections<S extends CMSSources> = UnionToIntersection<
  { [K in keyof S]: S[K] extends CMSAdapter<infer C> ? C : never }[keyof S]
>;
