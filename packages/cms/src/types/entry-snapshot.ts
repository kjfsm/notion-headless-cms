import type { JsonValue } from "./json-value.js";

/**
 * 正規化された Notion block。全ブロック種を網羅し、未対応ブロックも
 * `unsupported` として保持する（v2 の「黙ってスキップ」を廃止）。
 * ブロック種別ごとのフィールド定義は #439（パイプライン純関数化）で確定する。
 * S1 時点では「型に関数を含めない」という制約だけを固定する。
 */
export interface NormalizedBlock {
  readonly id: string;
  readonly type: string;
  readonly data: JsonValue;
  readonly children?: readonly NormalizedBlock[];
}

/** 画像ハッシュ → 事前パース済みメタデータ（CLS ゼロ化・variant 生成はしない）。 */
export interface ImageMapEntry {
  readonly hash: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly contentType: string;
}

/** 内部リンク（link_to_page / page mention）の解決結果。 */
export interface ResolvedLink {
  readonly href: string;
  readonly title: string | null;
}

/**
 * マテリアライズされたエントリの本体。R2 に JSON として保存される。
 * `meta` はコレクション固有のプロパティ値（`InferEntry` の戻り値）。
 *
 * 完全にシリアライズ可能（関数・クラスインスタンスを含まない）であることを
 * `AssertJsonValue` で型テストとして固定する。
 */
export interface EntrySnapshot<Meta extends JsonValue = JsonValue> {
  readonly collection: string;
  readonly slug: string;
  /** `last_edited_time`。KV index の version と突き合わせて鮮度判定する。 */
  readonly version: string;
  readonly meta: Meta;
  readonly blocks: readonly NormalizedBlock[];
  /** hash をキーにした画像メタデータ。 */
  readonly images: Readonly<Record<string, ImageMapEntry>>;
  /** 正規化 pageId をキーにした内部リンク解決マップ。 */
  readonly links: Readonly<Record<string, ResolvedLink>>;
}
