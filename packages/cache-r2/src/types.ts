/** R2 オブジェクトの最小インターフェース。R2Object は structural に互換。 */
export interface R2ObjectLike {
	json<T>(): Promise<T>;
	arrayBuffer(): Promise<ArrayBuffer>;
	httpMetadata?: { contentType?: string };
}

/**
 * R2Bucket の最小インターフェース。
 * Cloudflare Workers の R2Bucket は structural に互換なのでそのまま渡せる。
 * Workers 以外の環境（Node テスト、mock など）でも型エラーなしで使用可能。
 */
export interface R2BucketLike {
	get(key: string): Promise<R2ObjectLike | null>;
	put(
		key: string,
		value: ArrayBuffer | string,
		opts?: { httpMetadata?: { contentType?: string } },
	): Promise<unknown>;
}
