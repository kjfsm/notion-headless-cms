/**
 * テストページに Notion API でサポートされる主要ブロック種別を、
 * 各ブロックのオプション (color, icon variants, ネスト, has_row_header など) も
 * 含めて網羅的に投入するスクリプト。
 *
 * 既存の子ブロックは全て archive (=削除) してから、新しい構成で `blocks.children.append` する。
 *
 * 使い方:
 *   NOTION_TOKEN=xxx pnpm seed
 *   または NOTION_TEST_PAGE_ID=<page-uuid> で対象ページを上書き指定
 *
 * API で作成不可・スキップしているブロック:
 * - link_preview          公式 API 不可。段落内ハイパーリンクで代替
 * - child_page            append API では作成不可 (pages.create を使う別フロー)
 * - child_database        append API では作成不可 (data_sources.create を使う別フロー)
 * - breadcrumb            型上は作成可だが投入しても表示されない既知挙動
 * - synced_block (ref側)  型上は作成可だが UI で安定しないため除外
 * - template              Notion 廃止扱い
 */

import "dotenv/config";
import { createHash } from "node:crypto";

import { Client } from "@notionhq/client";

import { schema } from "../src/schema.js";

const postsDataSourceId = schema.collections.posts.dataSourceId;

const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) {
  throw new Error("NOTION_TOKEN env が設定されていません。");
}

const client = new Client({ auth: TOKEN });

const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const SAMPLE_BOOKMARK_URL = "https://github.com";
const SAMPLE_EMBED_URL = "https://codepen.io/chriscoyier/pen/MWLEMOY";
const SAMPLE_IMAGE_URL = "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=1200";
const SAMPLE_IMAGE_URL_2 = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200";
const SAMPLE_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";
const SAMPLE_PDF_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const SAMPLE_AUDIO_URL = "https://www.w3schools.com/html/horse.mp3";
const SAMPLE_FILE_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const SAMPLE_EXTERNAL_ICON_URL = "https://www.notion.so/images/favicon.ico";

async function resolveTestPageId(): Promise<string> {
  if (process.env.NOTION_TEST_PAGE_ID) {
    return process.env.NOTION_TEST_PAGE_ID;
  }
  // Slug が "test" のページを優先。なければ DB の先頭ページを使う。
  const res = await client.dataSources.query({
    data_source_id: postsDataSourceId,
    page_size: 50,
  });
  for (const page of res.results) {
    if (page.object !== "page") continue;
    const props =
      (
        page as {
          properties?: Record<string, { type?: string; rich_text?: { plain_text: string }[] }>;
        }
      ).properties ?? {};
    const slugProp = props.Slug;
    const slug =
      slugProp?.type === "rich_text"
        ? (slugProp.rich_text?.map((t) => t.plain_text).join("") ?? "")
        : "";
    if (slug === "test" || slug === "test-blocks") {
      return page.id;
    }
  }
  const first = res.results[0];
  if (!first) {
    throw new Error(
      `データソース ${postsDataSourceId} にページが 1 件もありません。NOTION_TEST_PAGE_ID を指定してください。`,
    );
  }
  return first.id;
}

async function clearChildren(pageId: string): Promise<void> {
  let cursor: string | undefined;
  let total = 0;
  do {
    const res = await client.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const block of res.results) {
      try {
        await client.blocks.delete({ block_id: block.id });
        total++;
      } catch (err) {
        console.warn(`既存ブロック ${block.id} の削除に失敗しました:`, (err as Error).message);
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  console.log(`既存ブロック ${total} 件を archive しました。`);
}

type Block = Parameters<typeof client.blocks.children.append>[0]["children"][number];

// rich_text 配列要素の型 (paragraph 変種を property キーで判別して逆引き。
// `type?: "paragraph"` は optional なため `Extract<Block, { type: "paragraph" }>` は never になる)
type RichText = Extract<Block, { paragraph: unknown }>["paragraph"]["rich_text"][number];

// ApiColor は @notionhq/client の公式型 (公開 export には無いため API ドキュメント準拠で literal union を直書き)
type ApiColor =
  | "default"
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red"
  | "default_background"
  | "gray_background"
  | "brown_background"
  | "orange_background"
  | "yellow_background"
  | "green_background"
  | "blue_background"
  | "purple_background"
  | "pink_background"
  | "red_background";

// Notion API 公式の color 全 20 バリアント (default / 9 色 / 9 色の background)
const ALL_COLORS: ApiColor[] = [
  "default",
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
  "default_background",
  "gray_background",
  "brown_background",
  "orange_background",
  "yellow_background",
  "green_background",
  "blue_background",
  "purple_background",
  "pink_background",
  "red_background",
];

function rt(
  content: string,
  opts?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    code?: boolean;
    color?: ApiColor;
    link?: string;
  },
): RichText {
  const ann = opts
    ? {
        bold: opts.bold,
        italic: opts.italic,
        underline: opts.underline,
        strikethrough: opts.strikethrough,
        code: opts.code,
        color: opts.color,
      }
    : undefined;
  return {
    type: "text",
    text: { content, link: opts?.link ? { url: opts.link } : undefined },
    annotations: ann,
  };
}

// 戻り値型を明示しない: TS が narrow な literal 型を推論することで、
// nested children (BlockObjectWithSingleLevelOfChildrenRequest など) にも代入可能にする
function paragraph(text: string) {
  return {
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [{ type: "text" as const, text: { content: text } }],
    },
  };
}

function heading(level: 1 | 2 | 3, text: string) {
  // computed key は判別共用体で narrowing できないため、3 分岐でリテラルを書く
  const rich = [{ type: "text" as const, text: { content: text } }];
  if (level === 1) {
    return {
      object: "block" as const,
      type: "heading_1" as const,
      heading_1: {
        rich_text: rich,
        color: "default" as const,
        is_toggleable: false,
      },
    };
  }
  if (level === 2) {
    return {
      object: "block" as const,
      type: "heading_2" as const,
      heading_2: {
        rich_text: rich,
        color: "default" as const,
        is_toggleable: false,
      },
    };
  }
  return {
    object: "block" as const,
    type: "heading_3" as const,
    heading_3: {
      rich_text: rich,
      color: "default" as const,
      is_toggleable: false,
    },
  };
}

function buildBlocks(pageId: string, humanUserId: string | null): Block[] {
  return [
    // ─────────────────────────────────────────────────────────────
    heading(1, "テストページ: ブロック種別ショーケース"),
    paragraph(
      "このページは Notion API でサポートされるブロック型を、各種オプション (color / icon variants / ネスト / has_row_header / mention / inline equation など) を含めて網羅的に並べたものです。HTML レンダリング検証用。",
    ),

    // ─────────────────────────────────────────────────────────────
    heading(2, "1. テキスト装飾フル"),
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          rt("通常 / "),
          rt("太字", { bold: true }),
          rt(" / "),
          rt("斜体", { italic: true }),
          rt(" / "),
          rt("下線", { underline: true }),
          rt(" / "),
          rt("取消線", { strikethrough: true }),
          rt(" / "),
          rt("コード", { code: true }),
          rt(" / "),
          rt("赤文字", { color: "red" }),
          rt(" / "),
          rt("黄背景", { color: "yellow_background" }),
          rt(" / "),
          rt("リンク", { link: "https://www.notion.so" }),
          rt(" / "),
          rt("全部盛り", {
            bold: true,
            italic: true,
            underline: true,
            strikethrough: true,
            code: true,
            color: "blue_background",
            link: "https://www.notion.so",
          }),
          rt("\n改行を含む段落テキスト。  連続スペース  も保持されるか確認。"),
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "2. rich_text 全種類 (text / mention / equation inline)"),
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          rt("page mention → "),
          { type: "mention", mention: { type: "page", page: { id: pageId } } },
          rt(" / date (start) → "),
          {
            type: "mention",
            mention: { type: "date", date: { start: "2026-05-07" } },
          },
          rt(" / date (range) → "),
          {
            type: "mention",
            mention: {
              type: "date",
              date: { start: "2026-05-01", end: "2026-05-31" },
            },
          },
          ...(humanUserId
            ? ([
                rt(" / user → "),
                {
                  type: "mention" as const,
                  mention: {
                    type: "user" as const,
                    user: { id: humanUserId },
                  },
                },
              ] as RichText[])
            : []),
          rt(" / inline equation → "),
          { type: "equation", equation: { expression: "a^2 + b^2 = c^2" } },
          rt(" まで。"),
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "3. 見出し (heading_1/2/3 + is_toggleable + color)"),
    heading(1, "見出し 1 (通常)"),
    heading(2, "見出し 2 (通常)"),
    heading(3, "見出し 3 (通常)"),
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [rt("見出し 2 (toggle 付き)")],
        color: "default",
        is_toggleable: true,
        children: [
          paragraph("トグル見出しを開いた中身の段落。"),
          {
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [rt("トグル見出し配下のリスト項目")],
            },
          },
        ],
      },
    },
    {
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [rt("見出し 3 (color: red)")],
        color: "red",
        is_toggleable: false,
      },
    },
    {
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [rt("見出し 3 (color: blue_background)")],
        color: "blue_background",
        is_toggleable: false,
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "4. paragraph color 全 20 バリアント"),
    ...ALL_COLORS.map<Block>((color) => ({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [rt(`color = "${color}"`)],
        color,
      },
    })),

    // ─────────────────────────────────────────────────────────────
    heading(2, "5. リスト (ネスト構造)"),
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [rt("レベル 1 (箇条書き)")],
        children: [
          {
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [rt("レベル 2 (箇条書き)")],
              children: [
                {
                  object: "block",
                  type: "bulleted_list_item",
                  bulleted_list_item: {
                    rich_text: [rt("レベル 3 (箇条書き、3 段ネスト)")],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      object: "block",
      type: "numbered_list_item",
      numbered_list_item: {
        rich_text: [rt("番号付き 1")],
        children: [
          {
            object: "block",
            type: "numbered_list_item",
            numbered_list_item: {
              rich_text: [rt("番号付き 1.1 (ネスト)")],
            },
          },
          {
            object: "block",
            type: "numbered_list_item",
            numbered_list_item: {
              rich_text: [rt("番号付き 1.2 (ネスト)")],
            },
          },
        ],
      },
    },
    {
      object: "block",
      type: "numbered_list_item",
      numbered_list_item: {
        rich_text: [rt("番号付き 2")],
      },
    },
    {
      object: "block",
      type: "to_do",
      to_do: {
        rich_text: [rt("未完了タスク")],
        checked: false,
      },
    },
    {
      object: "block",
      type: "to_do",
      to_do: {
        rich_text: [rt("完了タスク")],
        checked: true,
        color: "green",
      },
    },
    {
      object: "block",
      type: "to_do",
      to_do: {
        rich_text: [rt("親タスク (子タスク付き)")],
        checked: false,
        children: [
          {
            object: "block",
            type: "to_do",
            to_do: {
              rich_text: [rt("子タスク 1")],
              checked: true,
            },
          },
          {
            object: "block",
            type: "to_do",
            to_do: {
              rich_text: [rt("子タスク 2")],
              checked: false,
            },
          },
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "6. ブロック装飾 (quote / callout)"),
    {
      object: "block",
      type: "quote",
      quote: {
        rich_text: [rt("単純な引用ブロック。")],
      },
    },
    {
      object: "block",
      type: "quote",
      quote: {
        rich_text: [rt("children を持つ引用ブロック (color: purple)")],
        color: "purple",
        children: [
          paragraph("引用の中の段落。"),
          {
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [rt("引用の中のリスト項目")],
            },
          },
        ],
      },
    },
    {
      object: "block",
      type: "callout",
      callout: {
        rich_text: [rt("emoji icon 付き callout (yellow_background)")],
        icon: { type: "emoji", emoji: "💡" },
        color: "yellow_background",
      },
    },
    {
      object: "block",
      type: "callout",
      callout: {
        rich_text: [rt("external icon 付き callout (gray_background)")],
        icon: { type: "external", external: { url: SAMPLE_EXTERNAL_ICON_URL } },
        color: "gray_background",
      },
    },
    {
      object: "block",
      type: "callout",
      callout: {
        // icon を省略したバリアント。Notion UI ではデフォルトアイコンが付く挙動を確認
        rich_text: [rt("icon 省略の callout (blue_background)")],
        color: "blue_background",
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "7. code バリアント"),
    {
      object: "block",
      type: "code",
      code: {
        rich_text: [
          rt("export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}"),
        ],
        language: "typescript",
        caption: [rt("TypeScript 例: caption 付き")],
      },
    },
    {
      object: "block",
      type: "code",
      code: {
        rich_text: [rt('def greet(name):\n    return f"Hello, {name}!"')],
        language: "python",
      },
    },
    {
      object: "block",
      type: "code",
      code: {
        rich_text: [rt('{\n  "name": "alice",\n  "age": 30\n}')],
        language: "json",
        caption: [rt("JSON 例: caption 付き")],
      },
    },
    {
      object: "block",
      type: "code",
      code: {
        rich_text: [rt('const greet = (name) => `Hello, ${name}!`;\nconsole.log(greet("World"));')],
        language: "javascript",
      },
    },
    {
      object: "block",
      type: "code",
      code: {
        rich_text: [
          rt("graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Do it]\n  B -->|No| D[Skip]"),
        ],
        language: "mermaid",
      },
    },
    {
      object: "block",
      type: "code",
      code: {
        rich_text: [rt('#!/bin/bash\necho "Hello, $1!"')],
        language: "shell",
      },
    },
    {
      object: "block",
      type: "code",
      code: {
        rich_text: [rt("これはプレーンテキストのコードブロック。")],
        language: "plain text",
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "8. 数式 (equation block)"),
    {
      object: "block",
      type: "equation",
      equation: { expression: "E = mc^2" },
    },
    {
      object: "block",
      type: "equation",
      equation: {
        expression: "\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}",
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "9. 区切り / 目次"),
    { object: "block", type: "divider", divider: {} },
    {
      object: "block",
      type: "table_of_contents",
      table_of_contents: { color: "default" },
    },
    {
      object: "block",
      type: "table_of_contents",
      table_of_contents: { color: "gray_background" },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "10. 折りたたみ (toggle)"),
    {
      object: "block",
      type: "toggle",
      toggle: {
        rich_text: [rt("単純な toggle (クリックで開く)")],
        children: [paragraph("折りたたみ内のテキスト。")],
      },
    },
    {
      object: "block",
      type: "toggle",
      toggle: {
        rich_text: [rt("ネストした toggle (color: pink_background)")],
        color: "pink_background",
        children: [
          paragraph("外側 toggle の中身。"),
          {
            object: "block",
            type: "toggle",
            toggle: {
              rich_text: [rt("内側 toggle (2 段ネスト)")],
              children: [paragraph("一番奥の段落。")],
            },
          },
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "11. テーブル (column header / row header)"),
    {
      object: "block",
      type: "table",
      table: {
        table_width: 3,
        has_column_header: true,
        has_row_header: false,
        children: [
          {
            object: "block",
            type: "table_row",
            table_row: {
              cells: [[rt("列 A")], [rt("列 B")], [rt("列 C")]],
            },
          },
          {
            object: "block",
            type: "table_row",
            table_row: {
              cells: [[rt("1-A")], [rt("1-B")], [rt("1-C")]],
            },
          },
          {
            object: "block",
            type: "table_row",
            table_row: {
              cells: [[rt("2-A")], [rt("2-B")], [rt("2-C")]],
            },
          },
        ],
      },
    },
    {
      object: "block",
      type: "table",
      table: {
        table_width: 3,
        has_column_header: true,
        has_row_header: true,
        children: [
          {
            object: "block",
            type: "table_row",
            table_row: {
              cells: [[rt("行ヘッダ")], [rt("項目")], [rt("値")]],
            },
          },
          {
            object: "block",
            type: "table_row",
            table_row: {
              cells: [
                [rt("リッチセル", { bold: true })],
                [rt("link", { link: "https://www.notion.so" })],
                [rt("改行\nあり / "), { type: "equation", equation: { expression: "x^2" } }],
              ],
            },
          },
          {
            object: "block",
            type: "table_row",
            table_row: {
              cells: [[rt("行ヘッダ 2", { bold: true })], [rt("通常")], [rt("通常")]],
            },
          },
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "12. マルチカラム (column_list / column)"),
    {
      object: "block",
      type: "column_list",
      column_list: {
        children: [
          {
            object: "block",
            type: "column",
            column: {
              width_ratio: 0.5,
              children: [
                paragraph("左カラム (width_ratio: 0.5)"),
                {
                  object: "block",
                  type: "image",
                  image: {
                    type: "external",
                    external: { url: SAMPLE_IMAGE_URL },
                  },
                },
              ],
            },
          },
          {
            object: "block",
            type: "column",
            column: {
              width_ratio: 0.5,
              children: [
                paragraph("右カラム (width_ratio: 0.5)"),
                {
                  object: "block",
                  type: "image",
                  image: {
                    type: "external",
                    external: { url: SAMPLE_IMAGE_URL_2 },
                  },
                },
              ],
            },
          },
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "13. メディア (image / video / pdf / audio / file)"),
    {
      object: "block",
      type: "image",
      image: {
        type: "external",
        external: { url: SAMPLE_IMAGE_URL },
        caption: [rt("外部 URL の画像 (caption 付き)")],
      },
    },
    {
      object: "block",
      type: "image",
      image: {
        type: "external",
        external: { url: SAMPLE_IMAGE_URL_2 },
        // caption 省略
      },
    },
    {
      object: "block",
      type: "video",
      video: {
        type: "external",
        external: { url: SAMPLE_VIDEO_URL },
        caption: [rt("MP4 動画 (caption 付き)")],
      },
    },
    {
      object: "block",
      type: "video",
      video: {
        type: "external",
        external: { url: YOUTUBE_URL },
        caption: [rt("YouTube URL を video ブロックに渡した例")],
      },
    },
    {
      object: "block",
      type: "pdf",
      pdf: {
        type: "external",
        external: { url: SAMPLE_PDF_URL },
        caption: [rt("PDF サンプル")],
      },
    },
    {
      object: "block",
      type: "audio",
      audio: {
        type: "external",
        external: { url: SAMPLE_AUDIO_URL },
        caption: [rt("MP3 音声サンプル")],
      },
    },
    {
      object: "block",
      type: "file",
      file: {
        type: "external",
        external: { url: SAMPLE_FILE_URL },
        caption: [rt("汎用ファイル添付サンプル")],
        name: "dummy.pdf",
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "14. bookmark / embed"),
    {
      object: "block",
      type: "bookmark",
      bookmark: {
        url: SAMPLE_BOOKMARK_URL,
        caption: [rt("GitHub のブックマーク")],
      },
    },
    {
      object: "block",
      type: "embed",
      embed: {
        url: SAMPLE_EMBED_URL,
        caption: [rt("CodePen 埋め込み")],
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "15. YouTube 3 連 (本題: bookmark / 段落リンク / embed)"),
    paragraph(
      "Notion 上で同じ YouTube URL を 3 通りの方法で貼り付けたもの相当。期待: カード → テキスト → カード。",
    ),
    {
      object: "block",
      type: "bookmark",
      bookmark: {
        url: YOUTUBE_URL,
        caption: [rt("YouTube bookmark (上のカード)")],
      },
    },
    {
      // link_preview は API で作成不可。代わりに段落内ハイパーリンクで「中段の文字」を代用する。
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          rt("YouTube メンション (link_preview 代替): "),
          rt("Rick Astley - Never Gonna Give You Up", { link: YOUTUBE_URL }),
        ],
      },
    },
    {
      object: "block",
      type: "embed",
      embed: {
        url: YOUTUBE_URL,
        caption: [rt("YouTube embed (下のカード)")],
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "16. link_to_page (テストページ自身を参照)"),
    {
      object: "block",
      type: "link_to_page",
      link_to_page: { type: "page_id", page_id: pageId },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "17.1 heading_4 + 通常見出しに children"),
    {
      object: "block",
      type: "heading_4",
      heading_4: {
        rich_text: [rt("heading_4 (color: orange)")],
        color: "orange",
        is_toggleable: false,
      },
    },
    {
      object: "block",
      type: "heading_4",
      heading_4: {
        rich_text: [rt("heading_4 (toggle 付き, pink_background)")],
        color: "pink_background",
        is_toggleable: true,
        children: [paragraph("heading_4 のトグル中身。")],
      },
    },

    // ─────────────────────────────────────────────────────────────
    // 注: paragraph.icon は型上は許可されるが、API 制約で「tab block の直接の子」のみ
    //     有効。通常ページでは validation_error となるため投入しない。
    // ─────────────────────────────────────────────────────────────
    heading(2, "17.3 リンク付き画像 / caption への rich annotation"),
    paragraph(
      "API には image.link は無いため、caption 内に link 付き rich_text を入れることで「リンク付き画像」を再現する。caption は他のメディアでも annotations / link / 改行 を含められる。",
    ),
    {
      object: "block",
      type: "image",
      image: {
        type: "external",
        external: { url: SAMPLE_IMAGE_URL },
        // caption を「クリックで Unsplash へ」というリンクテキストにすることで実質リンク付き画像
        caption: [
          rt("📸 Unsplash で開く →  ", { italic: true }),
          rt("画像ソース", {
            link: "https://unsplash.com/photos/photo-1503023345310-bd7c1de61c7d",
            bold: true,
            color: "blue",
          }),
        ],
      },
    },
    {
      object: "block",
      type: "video",
      video: {
        type: "external",
        external: { url: SAMPLE_VIDEO_URL },
        caption: [
          rt("動画", { bold: true, color: "red" }),
          rt(" / "),
          rt("ソース", { link: SAMPLE_VIDEO_URL, underline: true }),
        ],
      },
    },
    {
      object: "block",
      type: "code",
      code: {
        rich_text: [rt('console.log("rich caption demo");')],
        language: "javascript",
        caption: [
          rt("出典: ", { italic: true }),
          rt("MDN", {
            link: "https://developer.mozilla.org/ja/docs/Web/JavaScript",
            bold: true,
          }),
          rt(" / 改行\n2 行目"),
        ],
      },
    },
    {
      object: "block",
      type: "bookmark",
      bookmark: {
        url: "https://www.notion.so",
        caption: [
          rt("Notion 公式", { bold: true, color: "purple" }),
          rt(" - "),
          rt("Notion へ", { link: "https://www.notion.so", italic: true }),
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "17.4 mention 追加バリアント (annotated)"),
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          // 注: mention.database / template_mention.* は本 Integration では
          // validation_error ("Only blocks ... can be synced" あるいは
          // "Template mentions cannot be created outside of templates") で投入不可
          rt("annotated page mention → "),
          {
            type: "mention",
            mention: { type: "page", page: { id: pageId } },
            annotations: { bold: true, color: "red" },
          },
          rt(" / 通常 page mention → "),
          {
            type: "mention",
            mention: { type: "page", page: { id: pageId } },
          },
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────
    // 注: link_to_page の database_id バリアントは Integration の DB アクセス権の
    //     関係で validation_error になるため除外。page_id バリアントは section 16 で投入済み
    // ─────────────────────────────────────────────────────────────
    heading(2, "17.6 column_list 3 列 + 偏った width_ratio"),
    {
      object: "block",
      type: "column_list",
      column_list: {
        children: [
          {
            object: "block",
            type: "column",
            column: {
              width_ratio: 0.2,
              children: [paragraph("狭い (0.2)")],
            },
          },
          {
            object: "block",
            type: "column",
            column: {
              width_ratio: 0.6,
              children: [
                paragraph("広い (0.6)"),
                {
                  object: "block",
                  type: "callout",
                  callout: {
                    rich_text: [rt("中央カラムの callout")],
                    icon: { type: "emoji", emoji: "⭐" },
                    color: "yellow_background",
                  },
                },
              ],
            },
          },
          {
            object: "block",
            type: "column",
            column: {
              width_ratio: 0.2,
              children: [paragraph("狭い (0.2)")],
            },
          },
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "17.7 table 追加バリアント (header 無し / width 5)"),
    {
      object: "block",
      type: "table",
      table: {
        table_width: 2,
        has_column_header: false,
        has_row_header: false,
        children: [
          {
            object: "block",
            type: "table_row",
            table_row: { cells: [[rt("ヘッダ無し A")], [rt("ヘッダ無し B")]] },
          },
          {
            object: "block",
            type: "table_row",
            table_row: { cells: [[rt("行 2-A")], [rt("行 2-B")]] },
          },
        ],
      },
    },
    {
      object: "block",
      type: "table",
      table: {
        table_width: 5,
        has_column_header: true,
        has_row_header: false,
        children: [
          {
            object: "block",
            type: "table_row",
            table_row: {
              cells: [[rt("Col1")], [rt("Col2")], [rt("Col3")], [rt("Col4")], [rt("Col5")]],
            },
          },
          {
            object: "block",
            type: "table_row",
            table_row: {
              cells: [[rt("a")], [rt("b")], [rt("c")], [rt("d")], [rt("e")]],
            },
          },
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────
    heading(2, "17.8 空 toggle / children 無し"),
    {
      object: "block",
      type: "toggle",
      toggle: {
        rich_text: [rt("children を持たない toggle (展開しても空)")],
        color: "gray_background",
      },
    },
    {
      object: "block",
      type: "callout",
      callout: {
        // rich_text を空配列にしたバリアント (icon と color だけが見える)
        rich_text: [],
        icon: { type: "emoji", emoji: "🟦" },
        color: "blue_background",
      },
    },

    // ─────────────────────────────────────────────────────────────
    // 注: synced_block は本ワークスペース/Integration で
    //     "Only blocks within the same workspace and that are accessible to the integration can be synced"
    //     の validation_error が出るため除外。original 側 (synced_from: null) でも発生
  ];
}

async function appendInChunks(pageId: string, blocks: Block[], after?: string): Promise<number> {
  // children.append は 1 回 100 件まで。`after` を渡すと指定ブロック直後に挿入できるが、
  // 100 件を超える場合は 2 回目以降は after なしの末尾追加になる (チャンク跨ぎ非対応)
  const CHUNK = 100;
  let total = 0;
  for (let i = 0; i < blocks.length; i += CHUNK) {
    const slice = blocks.slice(i, i + CHUNK);
    const res = await client.blocks.children.append({
      block_id: pageId,
      children: slice,
      ...(i === 0 && after ? { after } : {}),
    });
    total += res.results.length;
  }
  return total;
}

// ─── 差分 sync の実装 ────────────────────────────────────────────────
// 戦略:
// 1. desired blocks を「heading_2 で区切られたセクション」に分解 (intro = 先頭の heading_1+段落)
// 2. 各セクションを canonical JSON 化し SHA256 hash を計算
// 3. ページ先頭に fingerprint callout (各セクションの hash を JSON で保持) を置く
// 4. 再実行時: 既存 fingerprint と desired を比較し、先頭から一致するセクションは保持
//    → 最初の不一致セクション以降を delete し、残り desired を append
// 5. 最後に fingerprint callout を blocks.update で書き換え

const FINGERPRINT_MARKER = "__NHC_SEED_FINGERPRINT__";

function sha256Short(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

// キーをソートして安定化した JSON。undefined は除外
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        const val = (v as Record<string, unknown>)[k];
        if (val !== undefined) sorted[k] = val;
      }
      return sorted;
    }
    return v;
  });
}

type Section = { title: string; blocks: Block[] };

function isHeading2(b: Block): boolean {
  return (b as { type?: string }).type === "heading_2";
}

function headingTextOf(b: Block): string {
  const h2 = (b as { heading_2?: { rich_text: Array<{ text?: { content?: string } }> } }).heading_2;
  if (!h2) return "";
  return h2.rich_text.map((t) => t.text?.content ?? "").join("");
}

function groupDesiredSections(blocks: Block[]): Section[] {
  const out: Section[] = [];
  let current: Section = { title: "_intro", blocks: [] };
  for (const b of blocks) {
    if (isHeading2(b)) {
      if (current.blocks.length > 0) out.push(current);
      current = { title: headingTextOf(b), blocks: [b] };
    } else {
      current.blocks.push(b);
    }
  }
  if (current.blocks.length > 0) out.push(current);
  return out;
}

type ExistingBlock = { id: string; type: string; [k: string]: unknown };

function existingHeadingText(b: ExistingBlock): string {
  const h2 = (b as { heading_2?: { rich_text: Array<{ plain_text: string }> } }).heading_2;
  if (!h2) return "";
  return h2.rich_text.map((t) => t.plain_text).join("");
}

type ExistingSection = { title: string; ids: string[] };

function groupExistingSections(blocks: ExistingBlock[]): ExistingSection[] {
  const out: ExistingSection[] = [];
  let current: ExistingSection = { title: "_intro", ids: [] };
  for (const b of blocks) {
    if (b.type === "heading_2") {
      if (current.ids.length > 0) out.push(current);
      current = { title: existingHeadingText(b), ids: [b.id] };
    } else {
      current.ids.push(b.id);
    }
  }
  if (current.ids.length > 0) out.push(current);
  return out;
}

async function fetchTopLevel(pageId: string): Promise<ExistingBlock[]> {
  const all: ExistingBlock[] = [];
  let cursor: string | undefined;
  do {
    const res = await client.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    all.push(...(res.results as unknown as ExistingBlock[]));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return all;
}

function buildFingerprintBlock(map: Record<string, string>): Block {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: [
        {
          type: "text",
          text: { content: `${FINGERPRINT_MARKER} ${JSON.stringify(map)}` },
          annotations: { code: true, color: "gray" },
        },
      ],
      icon: { type: "emoji", emoji: "🔖" },
      color: "gray_background",
    },
  };
}

function parseFingerprint(b: ExistingBlock): Record<string, string> | null {
  if (b.type !== "callout") return null;
  const callout = (b as { callout?: { rich_text: Array<{ plain_text: string }> } }).callout;
  if (!callout) return null;
  const text = callout.rich_text.map((t) => t.plain_text).join("");
  if (!text.startsWith(FINGERPRINT_MARKER)) return null;
  try {
    return JSON.parse(text.slice(FINGERPRINT_MARKER.length).trim()) as Record<string, string>;
  } catch {
    return null;
  }
}

async function deleteIds(ids: string[]): Promise<number> {
  let deleted = 0;
  for (const id of ids) {
    try {
      await client.blocks.delete({ block_id: id });
      deleted++;
    } catch (err) {
      console.warn(`削除失敗 ${id}:`, (err as Error).message);
    }
  }
  return deleted;
}

async function syncPage(pageId: string, allDesired: Block[]): Promise<void> {
  const desiredSections = groupDesiredSections(allDesired);
  const desiredFps: Record<string, string> = {};
  for (const s of desiredSections) {
    desiredFps[s.title] = sha256Short(canonicalJson(s.blocks));
  }

  const existingTop = await fetchTopLevel(pageId);
  const fpBlock = existingTop.find((b) => parseFingerprint(b) !== null);
  const existingFps = fpBlock ? parseFingerprint(fpBlock) : null;
  const forceRebuild = process.env.FORCE_REBUILD === "1";

  if (forceRebuild || !fpBlock || !existingFps) {
    console.log(
      forceRebuild ? "FORCE_REBUILD=1 → 全クリア + 再作成" : "fingerprint 不在 → 全クリア + 再作成",
    );
    await clearChildren(pageId);
    const blocks = [buildFingerprintBlock(desiredFps), ...allDesired];
    const n = await appendInChunks(pageId, blocks);
    console.log(`append 完了: ${n} 件`);
    return;
  }

  // fingerprint 以外の既存ブロックでセクション化
  const existingWithoutFp = existingTop.filter((b) => b.id !== fpBlock.id);
  const existingSections = groupExistingSections(existingWithoutFp);

  // 先頭から一致するセクション数を数える (title + hash 一致が条件)
  let prefixLen = 0;
  while (
    prefixLen < desiredSections.length &&
    prefixLen < existingSections.length &&
    desiredSections[prefixLen].title === existingSections[prefixLen].title &&
    desiredFps[desiredSections[prefixLen].title] === existingFps[existingSections[prefixLen].title]
  ) {
    prefixLen++;
  }

  if (prefixLen === desiredSections.length && prefixLen === existingSections.length) {
    console.log(`変更なし (${prefixLen} セクション一致) → スキップ`);
    return;
  }

  // 不一致セクションをまとめて delete
  const idsToDelete = existingSections.slice(prefixLen).flatMap((s) => s.ids);
  console.log(
    `セクション ${prefixLen}/${existingSections.length} 一致、` +
      `${existingSections.length - prefixLen} セクション (${idsToDelete.length} ブロック) 削除中...`,
  );
  const deleted = await deleteIds(idsToDelete);
  console.log(`削除完了: ${deleted} ブロック`);

  // 残り desired セクションを append (末尾に追加)
  const toAppend = desiredSections.slice(prefixLen).flatMap((s) => s.blocks);
  if (toAppend.length > 0) {
    const appended = await appendInChunks(pageId, toAppend);
    console.log(`新セクション append: ${appended} ブロック`);
  }

  // fingerprint callout を新しい hash map で更新
  await client.blocks.update({
    block_id: fpBlock.id,
    callout: {
      rich_text: [
        {
          type: "text",
          text: {
            content: `${FINGERPRINT_MARKER} ${JSON.stringify(desiredFps)}`,
          },
          annotations: { code: true, color: "gray" },
        },
      ],
    },
  });
  console.log("fingerprint callout 更新完了");
}

async function main(): Promise<void> {
  const pageId = await resolveTestPageId();
  console.log(`対象ページ: ${pageId}`);
  // mention.user 用に人間ユーザーを 1 人探す。bot は API で mention できない (validation_error)。
  // Internal Integration では users.list が 403 になるケースもあるため失敗時はスキップ
  let humanUserId: string | null = null;
  try {
    const usersRes = await client.users.list({ page_size: 50 });
    humanUserId = usersRes.results.find((u) => u.type === "person")?.id ?? null;
  } catch (err) {
    console.warn(
      "users.list 失敗 (権限不足のため user mention をスキップ):",
      (err as Error).message,
    );
  }
  console.log(
    humanUserId
      ? `mention 用 user id: ${humanUserId}`
      : "人間ユーザーが見つからないため user mention はスキップ",
  );
  const blocks = buildBlocks(pageId, humanUserId);
  await syncPage(pageId, blocks);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
