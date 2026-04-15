// Notion API integration

// Types
export type { Post } from "./notion";
export type { NotionEnv } from "./types";

// Notion API
export {
	getBlocks,
	getNotion,
	getPostBySlug,
	getPostMarkdown,
	getPosts,
} from "./notion";
