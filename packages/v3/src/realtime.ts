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

/** チャンネルタグを生成する（v2 `channelTag` を踏襲）。item: `c:posts:slug`、list: `c:posts`。 */
export function channelTag(collection: string, slug?: string): string {
  return slug ? `c:${collection}:${slug}` : `c:${collection}`;
}

/**
 * 同期完了時に version 同梱で push する（#437 ADR-5: KV 伝播遅延の迂回）。
 * クライアントは KV を経由せず「新しい version が存在する」ことを知り、再取得できる。
 * item チャンネルと list チャンネルの両方に配信する（一覧・詳細どちらの購読者にも届くように）。
 */
export async function publishVersionUpdate(
  realtime: RealtimeAdapter,
  collection: string,
  slug: string | undefined,
  version: string,
): Promise<void> {
  const payload: RealtimePayload = { collection, slug, version };
  await realtime.publish(channelTag(collection), payload);
  if (slug) await realtime.publish(channelTag(collection, slug), payload);
}
