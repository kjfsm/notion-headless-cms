import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { PluggableList, Processor } from "unified";
import { unified } from "unified";
import { rehypeImageCache } from "./rehype-image-cache";
import type { RendererOptions } from "./types";

// warm / list view では同じ構成で大量レンダリングするため、freeze 済み processor を使い回す。
// プラグイン配列は参照同一性 (===) で比較するので、呼び出しごとに新しい配列を渡すと再構築される。
interface ProcessorMeta {
  remarkLen: number;
  rehypeLen: number;
  dangerous: boolean;
}

const PROCESSOR_CACHE = new WeakMap<object, Processor>();
const PROCESSOR_META = new WeakMap<object, ProcessorMeta>();
const STATIC_PROCESSORS: Record<string, Processor> = Object.create(null);

interface CacheImageContext {
  imageProxyBase: string;
  cacheImage?: (url: string) => Promise<string>;
}

function buildProcessor(
  imgCtx: CacheImageContext,
  allowDangerousHtml: boolean,
  remarkPlugins: PluggableList,
  rehypePlugins: PluggableList,
): Processor {
  const p = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkPlugins)
    .use(
      remarkRehype,
      allowDangerousHtml ? { allowDangerousHtml: true } : undefined,
    )
    .use(rehypeImageCache, imgCtx)
    .use(rehypePlugins)
    .use(rehypeStringify);
  return p.freeze() as unknown as Processor;
}

/**
 * `cacheImage` 関数を WeakMap キーに使い、createClient のライフサイクルに合わせて processor を共有する。
 * これにより同一 client の全レンダリングで 1 つの freeze 済みパイプラインを再利用できる。
 */
function getProcessor(
  imgCtx: CacheImageContext,
  allowDangerousHtml: boolean,
  remarkPlugins: PluggableList,
  rehypePlugins: PluggableList,
): Processor {
  // プラグイン無し + cacheImage 無し: テストや素朴なケース。プロセス全体で静的に共有する
  if (
    !imgCtx.cacheImage &&
    remarkPlugins.length === 0 &&
    rehypePlugins.length === 0
  ) {
    const key = `${allowDangerousHtml ? 1 : 0}:${imgCtx.imageProxyBase}`;
    const existing = STATIC_PROCESSORS[key];
    if (existing) return existing;
    const proc = buildProcessor(imgCtx, allowDangerousHtml, [], []);
    STATIC_PROCESSORS[key] = proc;
    return proc;
  }

  const key = imgCtx.cacheImage ?? imgCtx;
  const keyObj = key as object;
  const cached = PROCESSOR_CACHE.get(keyObj);
  const meta = cached ? PROCESSOR_META.get(keyObj) : undefined;
  if (
    cached &&
    meta &&
    meta.remarkLen === remarkPlugins.length &&
    meta.rehypeLen === rehypePlugins.length &&
    meta.dangerous === allowDangerousHtml
  ) {
    return cached;
  }
  const proc = buildProcessor(
    imgCtx,
    allowDangerousHtml,
    remarkPlugins,
    rehypePlugins,
  );
  PROCESSOR_CACHE.set(keyObj, proc);
  PROCESSOR_META.set(keyObj, {
    remarkLen: remarkPlugins.length,
    rehypeLen: rehypePlugins.length,
    dangerous: allowDangerousHtml,
  });
  return proc;
}

/**
 * Markdown を HTML に変換する (unified + remark + rehype)。
 *
 * `cacheImage` 指定時は Notion の画像 URL をプロキシキーに書き換える。
 * `render` 指定時はパイプライン全体をユーザー実装に差し替える (notion-embed など)。
 * 同一構成では freeze 済み processor を再利用する。
 *
 * @example
 * ```ts
 * import { renderMarkdown } from "@notion-headless-cms/markdown-html";
 *
 * const html = await renderMarkdown("# Hello", {
 *   imageProxyBase: "/api/images",
 *   cacheImage: cms.cacheImage,
 * });
 * ```
 *
 * @see {@link RendererOptions} 各オプションの詳細。
 * @see {@link Transformer} Notion → Markdown の前段変換クラス。
 */
export async function renderMarkdown(
  markdown: string,
  options: RendererOptions = {},
): Promise<string> {
  const {
    imageProxyBase = "/api/images",
    cacheImage,
    remarkPlugins = [],
    rehypePlugins = [],
    render,
    allowDangerousHtml = false,
  } = options;

  if (render) {
    return render(markdown, {
      imageProxyBase,
      cacheImage: cacheImage ?? ((url) => Promise.resolve(url)),
    });
  }

  const processor = getProcessor(
    { imageProxyBase, cacheImage },
    allowDangerousHtml,
    remarkPlugins as PluggableList,
    rehypePlugins as PluggableList,
  );
  const result = await processor.process(markdown);
  return String(result);
}
