// このファイルは nhc generate により自動生成されました。手動編集は nhc generate で上書きされます。
// Config SHA: 0492f48cf3c2b23b934482919372350e4d344db92440b4da202c20f338416e21

import type { PropertyMap } from "@notion-headless-cms/core";
import type { SchemaMap } from "@notion-headless-cms/notion-source";

// ===========================================================
// posts  (ブログ記事DB)
// Notion DB ID: d8221462-5ae9-8396-bdac-8731f4ef685a
// ===========================================================

export const postsDataSourceId = "d8221462-5ae9-8396-bdac-8731f4ef685a";

/** Notion DB "ブログ記事DB" のプロパティマップ。 */
export const postsProperties = {
  status: {
    type: "status" as const,
    notion: "ステータス",
    options: ["下書き", "編集中", "公開済み"] as const,
  },
  publishedAt: { type: "date" as const, notion: "公開日" },
  slug: { type: "richText" as const, notion: "URL" },
  author: { type: "select" as const, notion: "著者" },
  name: { type: "title" as const, notion: "名前" },
} as const satisfies PropertyMap;

/** posts コレクションの 1 アイテム型。 */
export interface Post {
  /** Notion ページ ID。 */
  id: string;
  /** Notion ページの最終編集時刻 (ISO8601)。 */
  lastEditedTime: string;
  /** ページ作成日時 (ISO8601)。 */
  createdAt?: string;
  /** アーカイブ済み / ゴミ箱に入っている場合 true。core の list() から自動除外される。 */
  isArchived?: boolean;
  /** カバー画像 URL。未設定の場合は null。 */
  coverImageUrl?: string | null;
  /** 絵文字アイコン。絵文字以外 / 未設定の場合は null。 */
  iconEmoji?: string | null;
  /** Notion property: "ステータス" */
  status: "下書き" | "編集中" | "公開済み" | null;
  /** Notion property: "公開日" */
  publishedAt: string | null;
  /** Notion property: "URL" */
  slug: string;
  /** Notion property: "著者" */
  author: string | null;
  /** Notion property: "名前" */
  name: string | null;
  /** Notion ページタイトル。 */
  title?: string | null;
}

// =============================================================
// Schema 集約 (notionSource() に渡す)
// =============================================================

/** 全コレクションのスキーマ集約。`notionSource({ schema })` に渡す。 */
export const schema = {
  posts: {
    dataSourceId: postsDataSourceId,
    properties: postsProperties,
    slugField: "slug",
    statusField: "status",
  },
} as const satisfies SchemaMap;
