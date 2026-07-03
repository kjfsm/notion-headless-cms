/** 同期完了イベント。KV 伝播遅延を迂回するため version を同梱する（#437 ADR-5）。 */
export interface RealtimePayload {
  readonly collection: string;
  readonly slug?: string;
  readonly version: string;
}

/** WebSocket push の抽象。Cloudflare 実装 = DO（`RealtimeHubDO` の後継）。 */
export interface RealtimeAdapter {
  publish(tag: string, payload: RealtimePayload): Promise<void>;
}
