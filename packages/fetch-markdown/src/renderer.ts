import {
  type RendererFn,
  rehypeImageCache,
} from "@notion-headless-cms/markdown-html";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { PluggableList } from "unified";
import { unified } from "unified";
import { preprocessNotionMarkdown } from "./preprocess";
import { rehypeNotionTags } from "./rehype-notion-tags";

/**
 * Notion `GET /v1/pages/{id}/markdown` が返す **enhanced markdown** を HTML に変換する。
 * `@notion-headless-cms/fetch-markdown` の `markdownFetcher()` を使う時の標準 renderer。
 *
 * 標準 markdown 部分 (`#`, `**`, lists, links, GFM テーブル等) に加え、
 * Notion 独自タグ (`<callout>` / `<span color>` / `<mention-page>` / `<mention-date>` /
 * `<page>` / `<database>` / `<columns>` / `<column>` / `<file>` / `<table_of_contents/>`)
 * を `nhc-*` クラス付きの素直な HTML に変換する。スタイリングは利用側で当てる。
 *
 * インライン数式 `$\`...\`$` は Notion 固有の記法 (バックティックでエスケープ) のため、
 * パイプライン前に `$...$` に正規化してから remark-math が処理する。
 *
 * 画像 URL を `imageProxyBase` でプロキシ化したい場合は `cacheImage` を渡す。
 * 内部で `markdown-html` の `rehypeImageCache` を経由する。
 */
export const notionMarkdownRenderer: RendererFn = async (
  markdown,
  options = {},
) => {
  const {
    imageProxyBase = "/api/images",
    cacheImage,
    remarkPlugins = [],
    rehypePlugins = [],
  } = options;

  const normalized = preprocessNotionMarkdown(markdown);

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkPlugins as PluggableList)
    // Notion 独自タグは raw HTML として markdown に紛れ込んでくるので、
    // allowDangerousHtml + rehype-raw でちゃんと hast に展開してから変換する。
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeNotionTags)
    .use(rehypeImageCache, { imageProxyBase, cacheImage })
    .use(rehypePlugins as PluggableList)
    .use(rehypeStringify);

  const file = await processor.process(normalized);
  return String(file);
};
