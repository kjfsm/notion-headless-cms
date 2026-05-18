import { data } from "react-router";
import { defaultLocale, isLocale } from "~/lib/i18n/config";
import { getDocEntry } from "~/lib/markdown/load";
import { renderDocMarkdown } from "~/lib/markdown/render";
import type { Route } from "./+types/$";

export async function loader({ params }: Route.LoaderArgs) {
  // splat: /docs/foo/bar → params["*"] = "foo/bar"
  const raw = params["*"] ?? "";
  const segments = raw.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw data("Not Found", { status: 404 });
  }

  // 先頭が locale でなければ defaultLocale を補う（/docs/quickstart → /docs/ja/quickstart 相当）。
  const first = segments[0];
  const hasLocale = first !== undefined && isLocale(first);
  const locale = hasLocale ? first : defaultLocale;
  const slug = (hasLocale ? segments.slice(1) : segments).join("/");
  if (!slug) {
    throw data("Not Found", { status: 404 });
  }

  const entry = getDocEntry(locale, slug);
  if (!entry) {
    throw data("Not Found", { status: 404 });
  }

  const html = await renderDocMarkdown({
    locale,
    slug: entry.slug,
    body: entry.body,
  });

  return {
    html,
    title:
      entry.frontmatter.title ?? deriveTitleFromBody(entry.body) ?? entry.slug,
    description: entry.frontmatter.description ?? null,
    category: entry.frontmatter.category ?? null,
    filePath: entry.filePath,
    locale,
    slug: entry.slug,
  };
}

function deriveTitleFromBody(body: string): string | null {
  const m = body.match(/^#\s+(.+)$/m);
  return m?.[1] ?? null;
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not Found" }];
  return [
    { title: `${loaderData.title} | notion-headless-cms` },
    ...(loaderData.description
      ? [{ name: "description", content: loaderData.description }]
      : []),
  ];
}

export default function DocPage({ loaderData }: Route.ComponentProps) {
  const { html, title, description, category, filePath } = loaderData;
  const editUrl = `https://github.com/kjfsm/notion-headless-cms/edit/main/${filePath}`;
  return (
    <article>
      <header className="mb-10">
        {category && (
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-purple-500">
            {category}
          </p>
        )}
        <h1 className="mb-3 text-4xl font-black tracking-tighter text-gray-900">
          {title}
        </h1>
        {description && (
          <p className="text-base text-gray-500 leading-relaxed">
            {description}
          </p>
        )}
        <div className="mt-8 border-b border-gray-200" />
      </header>
      {/* rehype で生成した HTML を埋め込む。コンテンツソースは git 管理下の md なので XSS リスクなし。 */}
      <div
        className="prose prose-neutral max-w-none pt-2 prose-headings:tracking-tighter prose-headings:font-bold prose-a:text-purple-600 prose-a:no-underline hover:prose-a:underline prose-code:text-purple-600 prose-code:before:content-[''] prose-code:after:content-['']"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: コンテンツは git 管理下の md。
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <footer className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-500">
        <a
          href={editUrl}
          target="_blank"
          rel="noreferrer"
          className="transition hover:text-purple-600"
        >
          GitHub でこのページを編集
        </a>
      </footer>
    </article>
  );
}
