import type { PageObjectResponse } from "@notionhq/client";
import type {
  PropDef,
  PropertyMap,
  UnsupportedValue,
} from "../types/property.js";

/** Notion API が返すページプロパティの生の値（判別可能ユニオン）。 */
export type RawNotionProperty = PageObjectResponse["properties"][string];

/**
 * `people` / `last_edited_by` に入る値は person/bot/group など複数の判別可能ユニオン。
 * `name`/`avatar_url` を持たないバリアント(group 等)もあるため、構造的に緩く読む。
 */
function personFromUser(user: {
  id: string;
  name?: string | null;
  avatar_url?: string | null;
}): {
  id: string;
  name: string | null;
  avatarUrl: string | null;
} {
  return {
    id: user.id,
    name: user.name ?? null,
    avatarUrl: user.avatar_url ?? null,
  };
}

function unsupported(raw: unknown): UnsupportedValue {
  return { type: "unsupported", raw };
}

/**
 * Notion の生のページプロパティを、`prop.*` で定義した `PropDef` に従って
 * TypeScript の値へ変換する。I/O を行わない純関数。
 *
 * `kind` に対応する `raw.type` でなければ `UnsupportedValue` を返す
 * （黙ってスキップしない — v2 の反省）。
 */
export function mapPropertyValue(
  kind: PropDef["kind"],
  raw: RawNotionProperty | undefined,
): unknown {
  if (!raw) return unsupported(raw);
  switch (kind) {
    case "title":
      return raw.type === "title"
        ? raw.title.map((t) => t.plain_text).join("")
        : unsupported(raw);
    case "richText":
      return raw.type === "rich_text"
        ? raw.rich_text.map((t) => t.plain_text).join("")
        : unsupported(raw);
    case "select":
      return raw.type === "select"
        ? (raw.select?.name ?? null)
        : unsupported(raw);
    case "status":
      return raw.type === "status"
        ? (raw.status?.name ?? "")
        : unsupported(raw);
    case "multiSelect":
      return raw.type === "multi_select"
        ? raw.multi_select.map((o) => o.name)
        : unsupported(raw);
    case "date":
      return raw.type === "date" ? (raw.date?.start ?? null) : unsupported(raw);
    case "number":
      return raw.type === "number" ? raw.number : unsupported(raw);
    case "checkbox":
      return raw.type === "checkbox" ? raw.checkbox : unsupported(raw);
    case "url":
      return raw.type === "url" ? raw.url : unsupported(raw);
    case "formula":
      if (raw.type !== "formula") return unsupported(raw);
      switch (raw.formula.type) {
        case "string":
          return raw.formula.string ?? null;
        case "number":
          return raw.formula.number ?? null;
        case "boolean":
          return raw.formula.boolean ?? false;
        case "date":
          return raw.formula.date?.start ?? null;
        default:
          return unsupported(raw.formula);
      }
    case "rollup":
      if (raw.type !== "rollup") return unsupported(raw);
      switch (raw.rollup.type) {
        case "number":
          return raw.rollup.number ?? null;
        case "date":
          return raw.rollup.date?.start ?? null;
        case "array":
          return raw.rollup.array.map((item) => mapRollupArrayItem(item));
        default:
          return unsupported(raw.rollup);
      }
    case "relation":
      return raw.type === "relation"
        ? raw.relation.map((r) => r.id)
        : unsupported(raw);
    case "people":
      return raw.type === "people"
        ? raw.people.map((p) => personFromUser(p))
        : unsupported(raw);
    case "files":
      return raw.type === "files"
        ? raw.files.map((f) => ({
            name: f.name,
            url:
              f.type === "file"
                ? f.file.url
                : f.type === "external"
                  ? f.external.url
                  : "",
          }))
        : unsupported(raw);
    case "uniqueId":
      return raw.type === "unique_id"
        ? { prefix: raw.unique_id.prefix ?? null, number: raw.unique_id.number }
        : unsupported(raw);
    case "createdTime":
      return raw.type === "created_time" ? raw.created_time : unsupported(raw);
    case "lastEditedBy":
      return raw.type === "last_edited_by"
        ? personFromUser(raw.last_edited_by)
        : unsupported(raw);
    default:
      return unsupported(raw);
  }
}

// rollup の array 要素は他プロパティ型の生値がそのまま入れ子で来る。単純な原始値だけ拾う。
function mapRollupArrayItem(item: {
  type: string;
  [key: string]: unknown;
}): string | number | boolean | null {
  switch (item.type) {
    case "number":
      return (item.number as number | null) ?? null;
    case "checkbox":
      return (item.checkbox as boolean) ?? false;
    case "rich_text":
      return ((item.rich_text as { plain_text: string }[]) ?? [])
        .map((t) => t.plain_text)
        .join("");
    default:
      return null;
  }
}

/**
 * `properties` 定義に従い、ページ全体のプロパティをまとめて変換する。
 * 戻り値はコレクションの `meta` にそのまま載せられるプレーンオブジェクト。
 */
export function mapProperties<P extends PropertyMap>(
  properties: P,
  raw: PageObjectResponse["properties"],
): Record<keyof P, unknown> {
  const result = {} as Record<keyof P, unknown>;
  for (const key of Object.keys(properties) as (keyof P)[]) {
    const def = properties[key];
    if (!def) continue;
    result[key] = mapPropertyValue(def.kind, raw[key as string]);
  }
  return result;
}
