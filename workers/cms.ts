import { createCloudflareCMS } from "@notion-headless-cms/adapter-cloudflare";

const config = {
	schema: {
		properties: {
			title: "Title",
			slug: "Slug",
			status: "Status",
			author: "Author",
			date: "CreatedAt",
		},
		publishedStatuses: ["公開済み"],
		accessibleStatuses: ["公開済み", "下書き", "編集中"],
	},
	renderer: {
		imageProxyBase: "/api/images",
	},
};

/**
 * このサイト固有のNotionスキーマで設定されたCMSインスタンス。
 * Notionデータベースのプロパティ名・ステータス値・画像プロキシURLを設定する。
 */
export function getCMS(env: Env) {
	return createCloudflareCMS(env, config);
}
