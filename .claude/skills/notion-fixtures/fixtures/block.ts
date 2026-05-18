import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export const baseBlock = {
  object: "block" as const,
  id: "block-id",
  parent: { type: "page_id" as const, page_id: "page-id" },
  created_time: "2026-01-01T00:00:00.000Z",
  last_edited_time: "2026-01-01T00:00:00.000Z",
  created_by: { object: "user" as const, id: "user-id" },
  last_edited_by: { object: "user" as const, id: "user-id" },
  has_children: false,
  archived: false,
  in_trash: false,
};

export const richText = (content: string) => ({
  type: "text" as const,
  text: { content, link: null },
  annotations: {
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
    code: false,
    color: "default" as const,
  },
  plain_text: content,
  href: null,
});

export const paragraph = (
  content: string,
  overrides: Partial<BlockObjectResponse> = {},
) =>
  asBlock({
    ...baseBlock,
    type: "paragraph",
    paragraph: { rich_text: [richText(content)], color: "default" },
    ...overrides,
  });

export const heading = (
  level: 1 | 2 | 3,
  content: string,
  overrides: Partial<BlockObjectResponse> = {},
) => {
  const key = `heading_${level}` as const;
  return asBlock({
    ...baseBlock,
    type: key,
    [key]: {
      rich_text: [richText(content)],
      color: "default",
      is_toggleable: false,
    },
    ...overrides,
  });
};

export const image = (
  url: string,
  overrides: Partial<BlockObjectResponse> = {},
) =>
  asBlock({
    ...baseBlock,
    type: "image",
    image: { type: "external", external: { url }, caption: [] },
    ...overrides,
  });

export const code = (
  content: string,
  language = "typescript",
  overrides: Partial<BlockObjectResponse> = {},
) =>
  asBlock({
    ...baseBlock,
    type: "code",
    code: { rich_text: [richText(content)], language, caption: [] },
    ...overrides,
  });

export function asBlock(b: unknown): BlockObjectResponse {
  return b as BlockObjectResponse;
}
