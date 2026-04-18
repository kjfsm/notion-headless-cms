import type { StorageAdapter, StorageBinary } from "@notion-headless-cms/core";

/** Cloudflare R2Bucket を StorageAdapter として実装するキャッシュ層。 */
export class CloudflareR2StorageAdapter implements StorageAdapter {
	private readonly bucket: R2Bucket;

	constructor(bucket: R2Bucket) {
		this.bucket = bucket;
	}

	async get(key: string): Promise<ArrayBuffer | null> {
		const object = await this.bucket.get(key);
		if (!object) return null;
		return object.arrayBuffer();
	}

	async put(
		key: string,
		data: ArrayBuffer | ArrayBufferView | string,
		options?: { contentType?: string },
	): Promise<void> {
		await this.bucket.put(key, data, {
			httpMetadata: options?.contentType
				? { contentType: options.contentType }
				: undefined,
		});
	}

	async json<T>(key: string): Promise<T | null> {
		const object = await this.bucket.get(key);
		if (!object) return null;
		return object.json<T>();
	}

	async binary(key: string): Promise<StorageBinary | null> {
		const object = await this.bucket.get(key);
		if (!object) return null;
		return {
			data: await object.arrayBuffer(),
			contentType: object.httpMetadata?.contentType,
		};
	}
}

/** R2Bucket から StorageAdapter を生成するファクトリ。bucket が undefined の場合は undefined を返す。 */
export function createCloudflareR2StorageAdapter(
	bucket: R2Bucket | undefined,
): StorageAdapter | undefined {
	if (!bucket) return undefined;
	return new CloudflareR2StorageAdapter(bucket);
}
