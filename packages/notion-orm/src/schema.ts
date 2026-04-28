import type { z } from "zod";
import { getPlainText } from "./mapper";
import type { NotionPage } from "./types";

// ── フィールドマッピング型定義 ──────────────────────────────────────────────

export type NotionFieldType =
  | {
      type: "title" | "richText" | "url" | "checkbox" | "date" | "number";
      notion: string;
    }
  | { type: "multiSelect"; notion: string }
  | { type: "select"; notion: string }
  | { type: "status"; notion: string };

// id・updatedAt 等は Notion ページメタデータから自動設定されるシステムフィールド
type SystemField =
  | "id"
  | "updatedAt"
  | "lastEditedTime"
  | "createdAt"
  | "isArchived"
  | "isInTrash"
  | "coverImageUrl"
  | "iconEmoji";

// ── defineMapping ────────────────────────────────────────────────────────────

/**
 * Notion プロパティマッピングを定義する。
 * `id` / `updatedAt` はシステムフィールドのため指定不要。
 * 型レベルでキーがスキーマと一致することを保証する。ランタイムは恒等関数。
 */
export function defineMapping<T extends object>(
  mapping: { [K in keyof Omit<T, SystemField>]: NotionFieldType },
): { [K in keyof Omit<T, SystemField>]: NotionFieldType } {
  return mapping;
}

// ── NotionSchema オブジェクト型 ──────────────────────────────────────────────

export interface NotionSchema<T> {
  mapping: { [K in keyof T]: NotionFieldType };
  mapItem: (page: NotionPage) => T;
}

// ── defineSchema ─────────────────────────────────────────────────────────────

/**
 * Zod スキーマとマッピングを結合して NotionSchema を生成する。
 * 公開条件（publishedStatuses）は createCMS({ collections }) で設定する。
 *
 * @example
 * const PostSchema = z.object({ slug: z.string(), status: z.string() })
 * const mapping = defineMapping<z.infer<typeof PostSchema>>({
 *   slug: { notion: "Slug", type: "richText" },
 *   status: { notion: "Status", type: "select" },
 * })
 * const schema = defineSchema(PostSchema, mapping)
 */
export function defineSchema<S extends z.ZodRawShape>(
  zodSchema: z.ZodObject<S>,
  mapping: {
    [K in keyof Omit<z.infer<z.ZodObject<S>>, SystemField>]: NotionFieldType;
  },
): NotionSchema<z.infer<z.ZodObject<S>>> {
  type T = z.infer<z.ZodObject<S>>;

  return {
    mapping: mapping as { [K in keyof T]: NotionFieldType },
    mapItem: (page) => {
      const raw = parseMapping(
        page,
        mapping as { [K in keyof T]: NotionFieldType },
      );
      return zodSchema.parse(raw) as T;
    },
  };
}

// ── パーサー ─────────────────────────────────────────────────────────────────

type PropertyValue = NotionPage["properties"][string];

const SYSTEM_FIELDS = new Set([
  "id",
  "updatedAt",
  "lastEditedTime",
  "createdAt",
  "isArchived",
  "isInTrash",
  "coverImageUrl",
  "iconEmoji",
]);

function extractCoverUrl(page: NotionPage): string | null {
  const cover = page.cover;
  if (!cover) return null;
  if (cover.type === "external") return cover.external.url;
  if (cover.type === "file") return cover.file.url;
  return null;
}

function extractIconEmoji(page: NotionPage): string | null {
  const icon = page.icon;
  if (!icon) return null;
  if (icon.type === "emoji") return icon.emoji;
  return null;
}

function parseMapping<T>(
  page: NotionPage,
  mapping: { [K in keyof T]: NotionFieldType },
): Record<string, unknown> {
  const titleProp = Object.values(page.properties).find(
    (p) => p.type === "title",
  );
  const result: Record<string, unknown> = {
    id: page.id,
    updatedAt: page.last_edited_time,
    lastEditedTime: page.last_edited_time,
    title: titleProp?.type === "title" ? getPlainText(titleProp.title) : null,
    createdAt: page.created_time,
    isArchived: page.archived,
    isInTrash: page.in_trash,
    coverImageUrl: extractCoverUrl(page),
    iconEmoji: extractIconEmoji(page),
  };
  for (const [key, fieldDef] of Object.entries(mapping) as [
    string,
    NotionFieldType,
  ][]) {
    if (SYSTEM_FIELDS.has(key)) continue;
    result[key] = parseField(page.properties[fieldDef.notion], fieldDef);
  }
  return result;
}

function parseField(
  prop: PropertyValue | undefined,
  fieldDef: NotionFieldType,
): unknown {
  if (!prop) {
    if (fieldDef.type === "checkbox") return false;
    if (fieldDef.type === "multiSelect") return [];
    return null;
  }

  switch (fieldDef.type) {
    case "title":
      return getPlainText(prop.type === "title" ? prop.title : undefined);
    case "richText":
      return getPlainText(
        prop.type === "rich_text" ? prop.rich_text : undefined,
      );
    case "date":
      return prop.type === "date" ? (prop.date?.start ?? null) : null;
    case "number":
      return prop.type === "number" ? prop.number : null;
    case "checkbox":
      return prop.type === "checkbox" ? prop.checkbox : false;
    case "url":
      return prop.type === "url" ? prop.url : null;
    case "multiSelect":
      return prop.type === "multi_select"
        ? prop.multi_select.map((s) => s.name)
        : [];
    case "select":
      return prop.type === "select" ? (prop.select?.name ?? null) : null;
    case "status":
      return prop.type === "status" ? (prop.status?.name ?? null) : null;
  }
}
