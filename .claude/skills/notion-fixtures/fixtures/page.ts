import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export const basePage = (
  overrides: Partial<PageObjectResponse> = {},
): PageObjectResponse =>
  asPage({
    object: "page",
    id: "page-id",
    created_time: "2026-01-01T00:00:00.000Z",
    last_edited_time: "2026-01-01T00:00:00.000Z",
    created_by: { object: "user", id: "user-id" },
    last_edited_by: { object: "user", id: "user-id" },
    cover: null,
    icon: null,
    parent: { type: "database_id", database_id: "db-id" },
    archived: false,
    in_trash: false,
    properties: {},
    url: "https://www.notion.so/page-id",
    public_url: null,
    ...overrides,
  });

export const pageWithProperties = (
  properties: PageObjectResponse["properties"],
  overrides: Partial<PageObjectResponse> = {},
) => basePage({ properties, ...overrides });

export function asPage(p: unknown): PageObjectResponse {
  return p as PageObjectResponse;
}
