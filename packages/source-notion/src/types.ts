import type {
	PageObjectResponse,
	RichTextItemResponse,
} from "@notionhq/client";

/**
 * Notion のページオブジェクト。`@notionhq/client` が公開している
 * `PageObjectResponse` のエイリアス。ユーザーが `mapItem` を書く際はこの型を受け取る。
 */
export type NotionPage = PageObjectResponse;

/** Notion のリッチテキスト要素。`getPlainText` などの引数に使う。 */
export type NotionRichTextItem = RichTextItemResponse;

/**
 * Notion ページのプロパティ値型。`PageObjectResponse["properties"][string]` の型エイリアス。
 * `Extract` ユーティリティで特定のプロパティ型を絞り込める。
 *
 * @example
 * type SelectProp = Extract<NotionPropertyValue, { type: "select" }>;
 */
export type NotionPropertyValue = NotionPage["properties"][string];
