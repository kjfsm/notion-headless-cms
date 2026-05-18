import { Link } from "react-router";
import { defaultLocale } from "~/lib/i18n/config";
import { listDocEntries } from "~/lib/markdown/load";
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
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">ドキュメント</h1>
        <p className="mt-2 text-muted-foreground">
          notion-headless-cms のセットアップ・API・運用ガイド。
        </p>
      </header>
      {Array.from(grouped.entries()).map(([category, items]) => (
        <section key={category} className="mb-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
            {category}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.slug}>
                <Link
                  to={`/docs/${locale}/${item.slug}`}
                  className="block rounded-md border border-border p-4 transition-colors hover:bg-accent"
                >
                  <div className="font-medium">{item.title}</div>
                  {item.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.description}
                    </p>
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
