import type {
  BaseContentItem,
  CMSSchemaProperties,
  PropertyMap,
} from "@notion-headless-cms/core";
import { CMSError } from "@notion-headless-cms/core";
import { z } from "zod";
import type { NotionPage, NotionRichTextItem } from "./types";

const baseContentItemSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().nullable().optional(),
  updatedAt: z.string().min(1),
  lastEditedTime: z.string().min(1).optional(),
  status: z.string().optional(),
  publishedAt: z.string().optional(),
  createdAt: z.string().optional(),
  isArchived: z.boolean().optional(),
  isInTrash: z.boolean().optional(),
  coverImageUrl: z.string().nullable().optional(),
  iconEmoji: z.string().nullable().optional(),
});

/** Notionリッチテキスト配列をプレーンテキストに結合する。空または未定義の場合は null を返す。 */
export function getPlainText(
  items: NotionRichTextItem[] | undefined,
): string | null {
  if (!items || items.length === 0) return null;
  const joined = items.map((item) => item.plain_text).join("");
  return joined.length === 0 ? null : joined;
}

/** ページの title 型プロパティからプレーンテキストを取り出す。 */
function extractPageTitle(page: NotionPage): string | null {
  const titleProp = Object.values(page.properties).find(
    (p) => p.type === "title",
  );
  return titleProp?.type === "title" ? getPlainText(titleProp.title) : null;
}

/** page.cover から画像 URL を取り出す。設定なし / 未対応形式は null。 */
function extractCoverUrl(page: NotionPage): string | null {
  const cover = page.cover;
  if (!cover) return null;
  if (cover.type === "external") return cover.external.url;
  if (cover.type === "file") return cover.file.url;
  return null;
}

/** page.icon から絵文字を取り出す。絵文字でない / 未設定は null。 */
function extractIconEmoji(page: NotionPage): string | null {
  const icon = page.icon;
  if (!icon) return null;
  if (icon.type === "emoji") return icon.emoji;
  return null;
}

type PropertyValue = string | string[] | number | boolean | null;

/**
 * Notion ページを CLI 生成の PropertyMap に従ってフラットな Record に変換する。
 * ページ構成の知識（slug/status の意味）を持たず、すべてのプロパティを等しく扱う。
 * slug・title・updatedAt などの BaseContentItem フィールドも含む。
 */
export function mapItemFromPropertyMap(
  page: NotionPage,
  properties: PropertyMap,
): BaseContentItem {
  const result: Record<string, PropertyValue> &
    Pick<
      BaseContentItem,
      | "id"
      | "slug"
      | "updatedAt"
      | "lastEditedTime"
      | "createdAt"
      | "isArchived"
      | "isInTrash"
      | "coverImageUrl"
      | "iconEmoji"
    > = {
    id: page.id,
    updatedAt: page.last_edited_time,
    lastEditedTime: page.last_edited_time,
    title: extractPageTitle(page),
    slug: "",
    createdAt: page.created_time,
    isArchived: page.archived,
    isInTrash: page.in_trash,
    coverImageUrl: extractCoverUrl(page),
    iconEmoji: extractIconEmoji(page),
  };

  for (const [tsName, propDef] of Object.entries(properties)) {
    const prop = page.properties[propDef.notion];
    result[tsName] = extractPropertyValue(prop, propDef.type);
  }

  if (!result.slug) {
    throw new CMSError({
      code: "core/schema_invalid",
      message: `Notion ページのスラグが空です。PropertyMap に "slug" キーを含め、対応するプロパティに値が設定されているか確認してください。`,
      context: { operation: "mapItemFromPropertyMap", pageId: page.id },
    });
  }

  return result as BaseContentItem;
}

type PropValue = NotionPage["properties"][string] | undefined;

function extractPropertyValue(
  prop: PropValue,
  type: PropertyMap[string]["type"],
): PropertyValue {
  if (!prop) {
    if (type === "checkbox") return false;
    if (type === "multiSelect") return [];
    return null;
  }
  switch (type) {
    case "title":
      return prop.type === "title" ? getPlainText(prop.title) || null : null;
    case "richText":
      return prop.type === "rich_text"
        ? getPlainText(prop.rich_text) || null
        : null;
    case "select":
      return prop.type === "select" ? (prop.select?.name ?? null) : null;
    case "status":
      return prop.type === "status" ? (prop.status?.name ?? null) : null;
    case "multiSelect":
      return prop.type === "multi_select"
        ? prop.multi_select.map((s: { name: string }) => s.name)
        : [];
    case "date":
      return prop.type === "date" ? (prop.date?.start ?? null) : null;
    case "number":
      return prop.type === "number" ? prop.number : null;
    case "checkbox":
      return prop.type === "checkbox" ? prop.checkbox : false;
    case "url":
      return prop.type === "url" ? prop.url : null;
    default:
      return null;
  }
}

/**
 * Notion ページをデフォルトの BaseContentItem に変換する。
 * 独自の拡張型（title などを含む）が必要な場合は、本関数の戻り値に
 * 追加フィールドを足してカスタム mapItem を実装する。
 */
export function mapItem(
  page: NotionPage,
  props: Required<CMSSchemaProperties>,
): BaseContentItem {
  const statusProperty = page.properties[props.status];
  const dateProperty = page.properties[props.date];

  const parsed = baseContentItemSchema.safeParse({
    id: page.id,
    slug: (() => {
      const p = page.properties[props.slug];
      return p?.type === "rich_text" ? getPlainText(p.rich_text) : "";
    })(),
    title: extractPageTitle(page),
    status:
      statusProperty?.type === "status"
        ? (statusProperty.status?.name ?? undefined)
        : statusProperty?.type === "select"
          ? (statusProperty.select?.name ?? undefined)
          : undefined,
    publishedAt:
      dateProperty?.type === "date"
        ? (dateProperty.date?.start ?? page.created_time)
        : page.created_time,
    updatedAt: page.last_edited_time,
    lastEditedTime: page.last_edited_time,
    createdAt: page.created_time,
    isArchived: page.archived,
    isInTrash: page.in_trash,
    coverImageUrl: extractCoverUrl(page),
    iconEmoji: extractIconEmoji(page),
  });

  if (!parsed.success) {
    throw new CMSError({
      code: "core/schema_invalid",
      message: "Failed to parse Notion page into BaseContentItem.",
      context: {
        operation: "mapItem",
        pageId: page.id,
        issues: JSON.stringify(parsed.error.issues),
      },
    });
  }

  return parsed.data;
}
