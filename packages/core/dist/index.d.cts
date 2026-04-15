import * as _notionhq_client from '@notionhq/client';
import { Client } from '@notionhq/client';

interface NotionEnv {
    NOTION_TOKEN: string;
    NOTION_DATA_SOURCE_ID: string;
}

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

export { type NotionEnv, type Post, getBlocks, getNotion, getPostBySlug, getPostMarkdown, getPosts };
