import { walkBlocks } from "../pipeline/blocks.js";
import type { NormalizedBlock } from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";
import { isJsonRecord } from "./walk.js";

/**
 * `[block.type]` サブオブジェクトのような JSON 値から可視テキストを収集する。
 * rich_text 配列（本文・caption・table cell 等）は `plain_text` フィールドを持つ規約に
 * 従って再帰的に拾い、`expression`(equation)・`title`(child_page/child_database)・
 * `name`(file) のような単独の可視文字列フィールドも個別に拾う。
 */
function collectPlainText(value: JsonValue, out: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectPlainText(item, out);
    return;
  }
  if (!isJsonRecord(value)) return;
  if (typeof value.plain_text === "string") {
    if (value.plain_text) out.push(value.plain_text);
    return; // plain_text 自体にはこれ以上の可視テキストが無いため打ち切る
  }
  for (const key of ["expression", "title", "name"] as const) {
    const v = value[key];
    if (typeof v === "string" && v) out.push(v);
  }
  for (const child of Object.values(value)) collectPlainText(child, out);
}

/**
 * 正規化 block tree から FTS 索引用のプレーンテキストを抽出する（同期時に一度だけ実行）。
 * ブロック種別を決め打ちせず `data` 全体を走査するため、未対応ブロック（`unsupported`）の
 * `raw` に含まれるテキストも拾える。
 */
export function extractPlainText(blocks: readonly NormalizedBlock[]): string {
  const out: string[] = [];
  walkBlocks(blocks, (block) => {
    collectPlainText(block.data, out);
  });
  return out.join(" ");
}
