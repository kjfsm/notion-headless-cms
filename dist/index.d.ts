import * as _notionhq_client from '@notionhq/client';
import { Client } from '@notionhq/client';

interface NotionEnv {
    NOTION_TOKEN: string;
    NOTION_DATA_SOURCE_ID: string;
}
type NotionCacheEnv = NotionEnv & {
    CACHE_BUCKET?: R2Bucket | null;
};

type Post = {
    id: string;
    title: string;
    slug: string;
    status: string;
    createdAt: string;
    author: string;
    lastEdited: string;
};
declare function getNotion(env: NotionEnv): Client;
declare function getPosts(env: NotionEnv): Promise<Post[]>;
declare function getPostBySlug(env: NotionEnv, slug: string): Promise<Post | null>;
declare function getBlocks(env: NotionEnv, pageId: string): Promise<(_notionhq_client.PartialBlockObjectResponse | _notionhq_client.BlockObjectResponse)[]>;
declare function getPostMarkdown(env: NotionEnv, pageId: string): Promise<string>;

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

export { type BuildOptions, type CachedPost, type CachedPostList, type NotionCacheEnv, type NotionEnv, type Post, buildCachedPost, getBlocks, getCachedImage, getCachedPost, getCachedPostList, getNotion, getPostBySlug, getPostMarkdown, getPosts, setCachedImage, setCachedPost, setCachedPostList, sha256Hex };
