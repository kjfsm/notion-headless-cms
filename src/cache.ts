import type { Post } from "./notion";

export interface CachedPostList {
	posts: Post[];
	cachedAt: number; // Unix ms timestamp
}

export interface CachedPost {
	html: string;
	post: Post;
	notionLastEdited: string;
	cachedAt: number; // Unix ms timestamp
}

const POSTS_KEY = "posts.json";
const postKey = (slug: string) => `post/${slug}.json`;
const imageKey = (hash: string) => `images/${hash}`;

// 文字列をSHA-256でハッシュ化し、16進数文字列として返す。画像キーの生成に使用。
export async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

// R2から記事一覧キャッシュを取得する。キャッシュ未存在の場合はnullを返す。
export async function getCachedPostList(
	bucket: R2Bucket,
): Promise<CachedPostList | null> {
	const obj = await bucket.get(POSTS_KEY);
	if (!obj) return null;
	return obj.json<CachedPostList>();
}

// 記事一覧にcachedAtタイムスタンプを付与してR2に保存する。
export async function setCachedPostList(
	bucket: R2Bucket,
	posts: Post[],
): Promise<void> {
	const data: CachedPostList = { posts, cachedAt: Date.now() };
	await bucket.put(POSTS_KEY, JSON.stringify(data), {
		httpMetadata: { contentType: "application/json" },
	});
}

// R2からスラッグ指定の記事キャッシュを取得する。キャッシュ未存在の場合はnullを返す。
export async function getCachedPost(
	bucket: R2Bucket,
	slug: string,
): Promise<CachedPost | null> {
	const obj = await bucket.get(postKey(slug));
	if (!obj) return null;
	return obj.json<CachedPost>();
}

// 記事のHTMLとメタデータをR2にキャッシュする。
export async function setCachedPost(
	bucket: R2Bucket,
	slug: string,
	data: CachedPost,
): Promise<void> {
	await bucket.put(postKey(slug), JSON.stringify(data), {
		httpMetadata: { contentType: "application/json" },
	});
}

// R2からハッシュキーで画像を取得する。キャッシュ未存在の場合はnullを返す。
export async function getCachedImage(
	bucket: R2Bucket,
	hash: string,
): Promise<R2ObjectBody | null> {
	return bucket.get(imageKey(hash));
}

// 画像バイナリをContent-Typeとともにハッシュキーでキャッシュする。
export async function setCachedImage(
	bucket: R2Bucket,
	hash: string,
	data: ArrayBuffer,
	contentType: string,
): Promise<void> {
	await bucket.put(imageKey(hash), data, {
		httpMetadata: { contentType },
	});
}
