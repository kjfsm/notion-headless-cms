import { Link } from "react-router";

import { defaultLocale } from "../../lib/i18n/config";
import { listDocEntries } from "../../lib/markdown/load";
import type { Route } from "./+types/index";

export async function loader() {
  const entries = listDocEntries(defaultLocale).map((e) => ({
    slug: e.slug,
    title: e.frontmatter.title ?? e.slug,
    description: e.frontmatter.description ?? null,
    category: e.frontmatter.category ?? null,
  }));
  return { entries, locale: defaultLocale };
}

export function meta() {
  return [{ title: "ドキュメント | notion-headless-cms" }];
}

type Entry = Awaited<ReturnType<typeof loader>>["entries"][number];

export default function DocsIndex({ loaderData }: Route.ComponentProps) {
  const { entries, locale } = loaderData;
  // category ごとに束ねる。category 未指定は "その他" に集める。
  const grouped = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = e.category ?? "その他";
    const arr = grouped.get(key) ?? [];
    arr.push(e);
    grouped.set(key, arr);
  }

  return (
    <div>
      <header className="mb-12">
        <p className="mb-4 font-mono text-xs tracking-widest text-purple-500 uppercase">
          Documentation
        </p>
        <h1 className="text-4xl font-black tracking-tighter text-gray-900">ドキュメント</h1>
        <p className="mt-3 leading-relaxed text-gray-500">
          notion-headless-cms のセットアップ・API・運用ガイド。
        </p>
      </header>
      {Array.from(grouped.entries()).map(([category, items]) => (
        <section key={category} className="mb-12">
          <h2 className="mb-4 font-mono text-xs tracking-widest text-purple-500 uppercase">
            {category}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.slug}>
                <Link
                  to={`/docs/${locale}/${item.slug}`}
                  className="group block rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-purple-400 hover:shadow-sm"
                >
                  <div className="font-semibold tracking-tight text-gray-900 transition group-hover:text-purple-600">
                    {item.title}
                  </div>
                  {item.description && (
                    <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.description}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
