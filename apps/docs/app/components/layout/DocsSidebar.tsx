import {
  BookOpen,
  ChevronRight,
  FileText,
  FlaskConical,
  Layers,
} from "lucide-react";
import { NavLink } from "react-router";
import { cn } from "../../lib/utils";

export interface SidebarDocEntry {
  slug: string;
  title: string;
  category: string | null;
  order: number;
}

const SECTION_ORDER = ["はじめに", "ガイド", "APIリファレンス", "レシピ"];

const SECTION_ICONS: Record<string, React.ElementType> = {
  はじめに: BookOpen,
  ガイド: Layers,
  APIリファレンス: FileText,
  レシピ: FlaskConical,
};

interface DocsSidebarProps {
  docs: SidebarDocEntry[];
  locale: string;
  currentSlug?: string;
}

export function DocsSidebar({ docs, locale, currentSlug }: DocsSidebarProps) {
  // frontmatter category で束ねる。未指定は "その他"。
  const grouped = new Map<string, SidebarDocEntry[]>();
  for (const doc of docs) {
    const key = doc.category ?? "その他";
    const arr = grouped.get(key) ?? [];
    arr.push(doc);
    grouped.set(key, arr);
  }
  for (const arr of grouped.values()) {
    arr.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  }

  // SECTION_ORDER 優先で並べ、未知のカテゴリは末尾に追加。
  const orderedSections = [
    ...SECTION_ORDER.filter((s) => grouped.has(s)),
    ...Array.from(grouped.keys()).filter((s) => !SECTION_ORDER.includes(s)),
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-gray-100 bg-white px-4 py-8 overflow-y-auto">
      {orderedSections.map((section, sectionIndex) => {
        const items = grouped.get(section) ?? [];
        if (items.length === 0) return null;
        const SectionIcon = SECTION_ICONS[section] ?? FileText;
        return (
          <div key={section}>
            {sectionIndex > 0 && (
              <div className="my-6 border-t border-gray-100" />
            )}

            <div className="mb-2 flex items-center gap-2 px-2 py-1">
              <SectionIcon className="size-3.5 text-purple-400 shrink-0" />
              <h3 className="text-xs font-mono uppercase tracking-widest text-purple-500">
                {section}
              </h3>
            </div>

            <ul className="space-y-0.5">
              {items.map((doc, i) => {
                const isActive = doc.slug === currentSlug;
                return (
                  <li
                    key={doc.slug}
                    style={{
                      animationDelay: `${(sectionIndex * 5 + i) * 25}ms`,
                    }}
                    className="animate-slide-in-left"
                  >
                    <NavLink
                      to={`/docs/${locale}/${doc.slug}`}
                      className={cn(
                        "group flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors",
                        "border-l-2 pl-[10px]",
                        isActive
                          ? "border-purple-500 bg-purple-50 text-purple-700 font-medium"
                          : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50",
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          "size-3 shrink-0",
                          isActive
                            ? "text-purple-500"
                            : "text-gray-300 group-hover:text-gray-500",
                        )}
                      />
                      <span className="flex-1 truncate">{doc.title}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </aside>
  );
}
