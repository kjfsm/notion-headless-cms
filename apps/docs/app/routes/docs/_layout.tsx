import { Outlet, useLocation } from "react-router";
import {
  DocsSidebar,
  type SidebarDocEntry,
} from "~/components/layout/DocsSidebar";
import { defaultLocale, isLocale } from "~/lib/i18n/config";
import { listDocEntries } from "~/lib/markdown/load";

// loader は context 不要（md は静的バンドル）。レイアウト loader は同期でも書けるが、
// React Router の型と合わせるため async のまま。
export async function loader() {
  const entries: SidebarDocEntry[] = listDocEntries(defaultLocale).map(
    (e, i) => ({
      slug: e.slug,
      title: e.frontmatter.title ?? e.slug,
      category: e.frontmatter.category ?? null,
      order: e.frontmatter.order ?? 100 + i,
    }),
  );
  return { docs: entries, locale: defaultLocale };
}

export default function DocsLayout({
  loaderData,
}: {
  loaderData: { docs: SidebarDocEntry[]; locale: string };
}) {
  const { docs, locale } = loaderData;
  const location = useLocation();
  // 現在のスラッグを URL から導出。/docs/ja/foo/bar → "foo/bar"
  const path = location.pathname.replace(/^\/docs\//, "");
  const segments = path.split("/").filter(Boolean);
  const first = segments[0];
  const hasLocale = first !== undefined && isLocale(first);
  const currentSlug = (hasLocale ? segments.slice(1) : segments).join("/");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <div className="sticky top-14 h-[calc(100vh-3.5rem)] shrink-0">
        <DocsSidebar
          docs={docs}
          locale={locale}
          currentSlug={currentSlug || undefined}
        />
      </div>
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-3xl px-8 py-10 animate-fade-in-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
