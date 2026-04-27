import { createCMS, nodePreset } from "@notion-headless-cms/core";
import {
	notionEmbed,
	youtubeProvider,
} from "@notion-headless-cms/notion-embed";
import { createNotionCollection } from "@notion-headless-cms/notion-orm";
import { postsProperties, postsSourceId } from "../generated/nhc-schema.js";

const token = process.env.NOTION_TOKEN;
if (!token) {
	throw new Error("NOTION_TOKEN env が設定されていません。");
}

// notion-embed で OGP カードや YouTube カード描画を有効化する。
const embed = notionEmbed({
	providers: [youtubeProvider({ display: "card" })],
});

const posts = createNotionCollection({
	token,
	dataSourceId: postsSourceId,
	properties: postsProperties,
	blocks: embed.blocks,
});

export const cms = createCMS({
	...nodePreset({ ttlMs: 5 * 60_000, renderer: embed.renderer }),
	dataSources: { posts },
});
