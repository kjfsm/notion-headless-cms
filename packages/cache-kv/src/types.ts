/**
 * KV Namespace の最小インターフェース。
 * Cloudflare Workers の KVNamespace は structural に互換なのでそのまま渡せる。
 * Workers 以外の環境（Node テスト、mock など）でも型エラーなしで使用可能。
 */
export interface KVNamespaceLike {
	get(key: string, type: "text"): Promise<string | null>;
	put(key: string, value: string): Promise<void>;
}
