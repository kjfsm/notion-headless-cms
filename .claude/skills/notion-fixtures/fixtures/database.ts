// Notion 2025-09-03 API では database から data source へ分離されている。
// 詳細は packages/notion-orm の DataSource 型と .claude/rules/source-notion.md を参照。

export const baseDataSource = (overrides: Record<string, unknown> = {}) => ({
  object: "data_source" as const,
  id: "data-source-id",
  created_time: "2026-01-01T00:00:00.000Z",
  last_edited_time: "2026-01-01T00:00:00.000Z",
  title: [
    {
      type: "text" as const,
      text: { content: "Mock Data Source", link: null },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default" as const,
      },
      plain_text: "Mock Data Source",
      href: null,
    },
  ],
  properties: {},
  parent: { type: "database_id", database_id: "db-id" },
  archived: false,
  in_trash: false,
  ...overrides,
});

export function asDataSource<T = unknown>(d: unknown): T {
  return d as T;
}
