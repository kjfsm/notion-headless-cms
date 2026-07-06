import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";

import { DocsSidebar, type SidebarDocEntry } from "../../components/layout/DocsSidebar";
import { defaultLocale, isLocale } from "../../lib/i18n/config";
import { listDocEntries } from "../../lib/markdown/load";

// loader は context 不要（md は静的バンドル）。レイアウト loader は同期でも書けるが、
// React Router の型と合わせるため async のまま。
export async function loader() {
  const entries: SidebarDocEntry[] = listDocEntries(defaultLocale).map((e, i) => ({
    slug: e.slug,
    title: e.frontmatter.title ?? e.slug,
    category: e.frontmatter.category ?? null,
    order: e.frontmatter.order ?? 100 + i,
  }));
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

  // モバイル用ドロワーの開閉。ページ遷移したら自動で閉じる。
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] bg-white">
      {/* デスクトップ: 左に固定表示する通常のサイドバー */}
      <div className="sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 md:block">
        <DocsSidebar docs={docs} locale={locale} currentSlug={currentSlug || undefined} />
      </div>

      {/* モバイル: 背後のオーバーレイ。クリックで閉じる */}
      {open && (
        <button
          type="button"
          aria-label="サイドバーを閉じる"
          onClick={() => setOpen(false)}
          className="fixed inset-x-0 top-14 bottom-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
        />
      )}

      {/* モバイル: スライドインドロワー本体 */}
      <div
        className={`fixed top-14 left-0 z-50 h-[calc(100vh-3.5rem)] shadow-xl transition-transform duration-200 ease-out md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <DocsSidebar docs={docs} locale={locale} currentSlug={currentSlug || undefined} />
      </div>

      <main className="min-w-0 flex-1">
        {/* モバイル専用のトグルバー。サイドバーが開いている時はバツ印に切替 */}
        <div className="sticky top-14 z-30 flex items-center gap-2 border-b border-gray-100 bg-white/90 px-4 py-2 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "ドキュメント一覧を閉じる" : "ドキュメント一覧を開く"}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-purple-400 hover:text-purple-600"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
            {open ? "閉じる" : "目次"}
          </button>
        </div>
        <div className="mx-auto max-w-3xl animate-fade-in-up px-6 py-10 md:px-8 md:py-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
