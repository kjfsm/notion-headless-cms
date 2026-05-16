// このファイルは nhc generate により自動生成されました。手動編集は nhc generate で上書きされます。
// NOTION_TOKEN 設定後に `pnpm generate` を実行して再生成してください。

import type { PropertyMap } from "@notion-headless-cms/core";
import type { SchemaMap } from "@notion-headless-cms/notion-source";

// ===========================================================
// docs  (ドキュメントDB)
// Notion DB ID: d156cb8d-15f1-4710-b33e-cd7a75004d10
// ===========================================================

export const docsDataSourceId = "d156cb8d-15f1-4710-b33e-cd7a75004d10";

/** Notion DB "ドキュメントDB" のプロパティマップ。 */
export const docsProperties = {
  status: {
    type: "status" as const,
    notion: "ステータス",
    options: ["未着手", "進行中", "完了"] as const,
  },
  slug: { type: "richText" as const, notion: "スラッグ" },
  section: {
    type: "select" as const,
    notion: "セクション",
  },
  order: { type: "number" as const, notion: "順序" },
  description: { type: "richText" as const, notion: "説明" },
  name: { type: "title" as const, notion: "名前" },
} as const satisfies PropertyMap;

/** docs コレクションの 1 アイテム型。 */
export interface Doc {
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
  status: "未着手" | "進行中" | "完了" | null;
  /** Notion property: "スラッグ" */
  slug: string;
  /** Notion property: "セクション" (select 型は string | null に推論される) */
  section: string | null;
  /** Notion property: "順序" */
  order: number | null;
  /** Notion property: "説明" */
  description: string | null;
  /** Notion property: "名前" */
  name: string | null;
  /** Notion ページタイトル。 */
  title?: string | null;
  /** 公開日時。 */
  publishedAt?: string | null;
}

// ===========================================================
// pages  (固定ページDB)
// Notion DB ID: 51b3350b-d501-478c-815d-09447827e114
// ===========================================================

export const pagesDataSourceId = "51b3350b-d501-478c-815d-09447827e114";

/** Notion DB "固定ページDB" のプロパティマップ。 */
export const pagesProperties = {
  status: {
    type: "status" as const,
    notion: "ステータス",
    options: ["未着手", "進行中", "完了"] as const,
  },
  slug: { type: "richText" as const, notion: "スラッグ" },
  description: { type: "richText" as const, notion: "説明" },
  name: { type: "title" as const, notion: "名前" },
} as const satisfies PropertyMap;

/** pages コレクションの 1 アイテム型。 */
export interface Page {
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
  status: "未着手" | "進行中" | "完了" | null;
  /** Notion property: "スラッグ" */
  slug: string;
  /** Notion property: "説明" */
  description: string | null;
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
  docs: {
    dataSourceId: docsDataSourceId,
    properties: docsProperties,
    slugField: "slug",
    statusField: "status",
  },
  pages: {
    dataSourceId: pagesDataSourceId,
    properties: pagesProperties,
    slugField: "slug",
    statusField: "status",
  },
} as const satisfies SchemaMap;
