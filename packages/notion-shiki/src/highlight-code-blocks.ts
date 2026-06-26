import type { NotionBlockTreeNode } from "@notion-headless-cms/notion-orm";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  type NotionShikiOptions,
  normalizeLang,
  rehypePrettyCodeOptions,
} from "./options.js";

/** `highlightCodeBlocks()` のオプション。 */
export interface HighlightCodeBlocksOptions extends NotionShikiOptions {
  /** 行番号を表示するか。既定: `true`。 */
  showLineNumbers?: boolean;
}

interface CodePayload {
  rich_text: { plain_text: string }[];
  caption: { plain_text: string }[];
  language: string;
}

function createPipeline(opts: HighlightCodeBlocksOptions | undefined) {
  return unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypePrettyCode, rehypePrettyCodeOptions(opts))
    .use(rehypeStringify);
}

type Pipeline = ReturnType<typeof createPipeline>;

/**
 * `NotionBlock` ツリーを走査し、`code` ブロックを rehype-pretty-code で
 * シンタックスハイライトした HTML を `block.code.__cachedHtml` に埋めた
 * **新しい**ツリーを返す（入力はミューテートしない）。
 *
 * `react-renderer` の `Code` は `__cachedHtml` があればそれを描画するため、
 * サーバー側でこの関数を通してから `<NotionRenderer>` に渡すことで、
 * shiki をクライアントバンドルに含めずにハイライトを効かせられる。
 * `resolveBlockImageUrls` と同じ「表示前のサーバー前処理」パターン。
 *
 * - 言語が解決できない等で変換に失敗したブロックは素通し（Code 側の
 *   素の `<pre>` フォールバックに任せる）
 * - `code.caption` があれば rehype-pretty-code の `title`（ファイル名バー）に流す
 * - children は再帰処理
 *
 * @example
 * ```ts
 * const blocks = await highlightCodeBlocks(rawBlocks);
 * return <NotionRenderer blocks={blocks} />;
 * ```
 */
export async function highlightCodeBlocks(
  blocks: NotionBlockTreeNode[],
  opts?: HighlightCodeBlocksOptions,
): Promise<NotionBlockTreeNode[]> {
  const pipeline = createPipeline(opts);
  return Promise.all(blocks.map((block) => enrich(block, pipeline, opts)));
}

async function enrich(
  block: NotionBlockTreeNode,
  pipeline: Pipeline,
  opts: HighlightCodeBlocksOptions | undefined,
): Promise<NotionBlockTreeNode> {
  let next = block;
  if (block.type === "code") {
    const html = await highlight(block.code, pipeline, opts);
    if (html) {
      next = {
        ...block,
        code: { ...block.code, __cachedHtml: html },
      } as NotionBlockTreeNode;
    }
  }
  if (next.children?.length) {
    const children = await Promise.all(
      next.children.map((child) => enrich(child, pipeline, opts)),
    );
    next = { ...next, children };
  }
  return next;
}

async function highlight(
  code: CodePayload,
  pipeline: Pipeline,
  opts: HighlightCodeBlocksOptions | undefined,
): Promise<string | null> {
  const source = code.rich_text.map((rt) => rt.plain_text).join("");
  const lang = normalizeLang(code.language);
  // ファイル名・言語ラベルは react-renderer の Code が caption から自前で描画する
  // ため、ここでは figcaption（title）は出さない。行番号のみ付与する。
  const meta = opts?.showLineNumbers === false ? "" : "showLineNumbers";
  try {
    const file = await pipeline.process(fence(source, lang, meta));
    return String(file);
  } catch {
    return null;
  }
}

/** source を壊さないよう、内部の最長バッククォート連長より長いフェンスで囲む。 */
function fence(source: string, lang: string, meta: string): string {
  const longest = (source.match(/`+/g) ?? []).reduce(
    (max, run) => Math.max(max, run.length),
    0,
  );
  const ticks = "`".repeat(Math.max(3, longest + 1));
  const info = [lang, meta].filter(Boolean).join(" ");
  return `${ticks}${info}\n${source}\n${ticks}`;
}
