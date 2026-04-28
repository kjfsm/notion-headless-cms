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
