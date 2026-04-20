// wrangler types で自動生成される型定義のテンプレート
// `wrangler types` を実行すると上書きされる
interface Env {
	NOTION_TOKEN: string;
	NOTION_DATA_SOURCE_ID: string;
	CACHE_BUCKET?: R2Bucket;
}
