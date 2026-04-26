import type {
	BaseContentItem,
	CachedItemContent,
	CachedItemList,
	CachedItemMeta,
	DocumentCacheAdapter,
	ImageCacheAdapter,
	InvalidateScope,
	StorageBinary,
} from "../types/index";

/** 何もキャッシュしないドキュメントキャッシュ実装。常に null を返す。 */
class NoopDocumentCache<T extends BaseContentItem = BaseContentItem>
	implements DocumentCacheAdapter<T>
{
	readonly name = "noop-document";

	getList(): Promise<CachedItemList<T> | null> {
		return Promise.resolve(null);
	}

	setList(_data: CachedItemList<T>): Promise<void> {
		return Promise.resolve();
	}

	getItemMeta(_slug: string): Promise<CachedItemMeta<T> | null> {
		return Promise.resolve(null);
	}

	setItemMeta(_slug: string, _data: CachedItemMeta<T>): Promise<void> {
		return Promise.resolve();
	}

	getItemContent(_slug: string): Promise<CachedItemContent | null> {
		return Promise.resolve(null);
	}

	setItemContent(_slug: string, _data: CachedItemContent): Promise<void> {
		return Promise.resolve();
	}

	invalidate(_scope: InvalidateScope): Promise<void> {
		return Promise.resolve();
	}
}

/** 何もキャッシュしない画像キャッシュ実装。常に null を返す。 */
class NoopImageCache implements ImageCacheAdapter {
	readonly name = "noop-image";

	get(_hash: string): Promise<StorageBinary | null> {
		return Promise.resolve(null);
	}

	set(_hash: string, _data: ArrayBuffer, _contentType: string): Promise<void> {
		return Promise.resolve();
	}
}

const _noopDocument = new NoopDocumentCache();
const _noopImage = new NoopImageCache();

/** 何もしないドキュメントキャッシュを返す（シングルトン）。 */
export function noopDocumentCache<
	T extends BaseContentItem = BaseContentItem,
>(): DocumentCacheAdapter<T> {
	return _noopDocument as DocumentCacheAdapter<T>;
}

/** 何もしない画像キャッシュを返す（シングルトン）。 */
export function noopImageCache(): ImageCacheAdapter {
	return _noopImage;
}
