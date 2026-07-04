import type { JsonValue } from "./types/json-value.js";

/**
 * Notion アクセスの直列化・遅延実行・永続状態を担う抽象。
 * Cloudflare 実装 = Durable Object（#441）、Node 実装 = in-process mutex + setTimeout。
 * 「Workers で最良、どこでも動く」を保つための構造型境界。
 */
export interface SyncScheduler {
  /** `delayMs` 後に `task` を実行する。既存の予約があれば置き換える（自己継続用）。 */
  schedule(delayMs: number, task: () => Promise<void>): Promise<void>;
  cancel(): Promise<void>;
  /** 同期カーソル・失敗記録などの永続状態を読む（doctor / stats が参照する）。 */
  getState(): Promise<Readonly<Record<string, JsonValue>> | null>;
  setState(state: Readonly<Record<string, JsonValue>>): Promise<void>;
}
