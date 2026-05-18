import rehypeShiki from "@shikijs/rehype";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

// docs 内の相対リンク（./architecture.md / ../recipes/foo.md）を URL に書き換える remark plugin。
// 例: locale=ja, currentSlug=quickstart の文中 "./architecture.md" → "/docs/ja/architecture"
function remarkRewriteDocLinks(opts: { locale: string; currentSlug: string }) {
  const baseSegments = opts.currentSlug.split("/").slice(0, -1);
  return (tree: unknown) => {
    visit(tree as never, "link", (node: { url?: string }) => {
      if (!node.url) return;
      const url = node.url;
      if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("/") ||
        url.startsWith("#") ||
        url.startsWith("mailto:")
      ) {
        return;
      }
      // 相対パス: 末尾の .md を取り、currentSlug の親と合わせて絶対 URL に
      const cleaned = url.replace(/\.md(#.*)?$/, "$1");
      const parts = cleaned.split("/");
      const resolved: string[] = [...baseSegments];
      for (const part of parts) {
        if (part === "" || part === ".") continue;
        if (part === "..") resolved.pop();
        else resolved.push(part);
      }
      node.url = `/docs/${opts.locale}/${resolved.join("/")}`;
    });
  };
}

// 単一プロセッサを freeze して再利用するための WeakMap キー。
const PROCESSOR_CACHE = new Map<string, ReturnType<typeof buildProcessor>>();

function buildProcessor(locale: string, currentSlug: string) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRewriteDocLinks, { locale, currentSlug })
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: "wrap",
      properties: { className: ["heading-anchor"] },
    })
    .use(rehypeShiki, {
      themes: { light: "github-light", dark: "github-dark" },
    })
    .use(rehypeStringify)
    .freeze();
}

export async function renderDocMarkdown(opts: {
  locale: string;
  slug: string;
  body: string;
}): Promise<string> {
  const key = `${opts.locale}:${opts.slug}`;
  let processor = PROCESSOR_CACHE.get(key);
  if (!processor) {
    processor = buildProcessor(opts.locale, opts.slug);
    PROCESSOR_CACHE.set(key, processor);
  }
  const result = await processor.process(opts.body);
  return String(result);
}
