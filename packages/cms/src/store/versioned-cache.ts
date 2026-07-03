/** Cache API の最小構造型(`caches.default` 等が構造的に満たす)。 */
export interface VersionedCacheLike {
  match(request: string): Promise<Response | undefined>;
  put(request: string, response: Response): Promise<void>;
}

export interface VersionedCacheOptions {
  /** 未指定 = Cache API 無効環境(workers.dev 等)。その場合すべて no-op で読者パスは KV+R2 直読みに落ちる。 */
  cache?: VersionedCacheLike;
}

function versionedKey(
  collection: string,
  slug: string,
  version: string,
): string {
  return `https://cache.internal/entry/${collection}/${slug}@${version}`;
}

export interface VersionedCacheLayer {
  get(
    collection: string,
    slug: string,
    version: string,
  ): Promise<Response | undefined>;
  put(
    collection: string,
    slug: string,
    version: string,
    response: Response,
  ): Promise<void>;
}

/**
 * versioned key(`entry:{collection}:{slug}@{version}` 相当)による Cache API の
 * オプショナル加速層。purge に依存しない設計(バージョンが変われば別キーになるだけ)。
 * `cache` 未指定時(Cache API 無効環境)でも読者パスが KV 1 読み + R2 1 読みで
 * 成立することが前提であり、この層はそれを透過的に加速するだけ。
 */
export function createVersionedCacheLayer(
  opts: VersionedCacheOptions,
): VersionedCacheLayer {
  return {
    async get(collection, slug, version) {
      if (!opts.cache) return undefined;
      try {
        return await opts.cache.match(versionedKey(collection, slug, version));
      } catch {
        // Cache API 例外時も読者パスは KV+R2 直読みで成立するため、この層は無視して透過させる。
        return undefined;
      }
    },
    async put(collection, slug, version, response) {
      if (!opts.cache) return;
      try {
        await opts.cache.put(versionedKey(collection, slug, version), response);
      } catch {
        // 加速層への書き込み失敗は読者パスに影響しないため無視する。
      }
    },
  };
}
