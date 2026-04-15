import type { NotionEnv, Post } from "@kjfsm/notion-core";

// Notion + R2 の両方を必要とする関数向けの複合型。
// CACHE_BUCKET をオプショナルにすることで、R2 未設定のローカル開発環境でも安全に動作する。
export type NotionCacheEnv = NotionEnv & { CACHE_BUCKET?: R2Bucket | null };

// R2キャッシュ用の型定義
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
