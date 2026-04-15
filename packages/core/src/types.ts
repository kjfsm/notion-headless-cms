// Notion API 認証とデータソース設定の最小インターフェース。
// アプリ固有の Env 型に依存しないよう、必要なフィールドのみ定義する。
export interface NotionEnv {
	NOTION_TOKEN: string;
	NOTION_DATA_SOURCE_ID: string;
}
