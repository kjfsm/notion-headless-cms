import { Post, NotionEnv } from '@kjfsm/notion-core';

type NotionCacheEnv = NotionEnv & {
    CACHE_BUCKET?: R2Bucket | null;
};
interface CachedPostList {
    posts: Post[];
    cachedAt: number;
}
interface CachedPost {
    html: string;
    post: Post;
    notionLastEdited: string;
    cachedAt: number;
}

declare function sha256Hex(input: string): Promise<string>;
declare function getCachedPostList(bucket: R2Bucket): Promise<CachedPostList | null>;
declare function setCachedPostList(bucket: R2Bucket, posts: Post[]): Promise<void>;
declare function getCachedPost(bucket: R2Bucket, slug: string): Promise<CachedPost | null>;
declare function setCachedPost(bucket: R2Bucket, slug: string, data: CachedPost): Promise<void>;
declare function getCachedImage(bucket: R2Bucket, hash: string): Promise<R2ObjectBody | null>;
declare function setCachedImage(bucket: R2Bucket, hash: string, data: ArrayBuffer, contentType: string): Promise<void>;

interface BuildOptions {
    /** 画像配信エンドポイントのプレフィックス（デフォルト: "/api/images"） */
    imageBaseUrl?: string;
}
declare function buildCachedPost(env: NotionCacheEnv, post: Post, options?: BuildOptions): Promise<CachedPost>;

export { type BuildOptions, type CachedPost, type CachedPostList, type NotionCacheEnv, buildCachedPost, getCachedImage, getCachedPost, getCachedPostList, setCachedImage, setCachedPost, setCachedPostList, sha256Hex };
