/** 文字列をSHA-256でハッシュ化し、16進数文字列として返す。画像キーの生成に使用。 */
export async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * キャッシュが有効期限切れかどうかを判定する。
 * ttlMs が未指定の場合は常に false（無期限有効）を返す。
 */
export function isStale(cachedAt: number, ttlMs?: number): boolean {
	if (ttlMs === undefined) return false;
	return Date.now() - cachedAt > ttlMs;
}
