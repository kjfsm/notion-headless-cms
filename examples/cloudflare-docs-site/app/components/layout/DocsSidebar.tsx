import * as Separator from "@radix-ui/react-separator";
import { NavLink } from "react-router";
import type { Doc } from "~/generated/nhc";
import { cn } from "~/lib/utils";

const SECTION_ORDER = ["はじめに", "ガイド", "APIリファレンス", "レシピ"];

interface DocsSidebarProps {
  docs: Doc[];
  currentSlug?: string;
}

export function DocsSidebar({ docs, currentSlug }: DocsSidebarProps) {
  const grouped = SECTION_ORDER.reduce<Record<string, Doc[]>>(
    (acc, section) => {
      acc[section] = docs
        .filter((doc) => doc.section === section)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return acc;
    },
    {},
  );

  const visibleSections = SECTION_ORDER.filter(
    (section) => grouped[section].length > 0,
  );

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 px-4 py-6 overflow-y-auto">
      {visibleSections.map((section, index) => (
        <div key={section}>
          {index > 0 && (
            <Separator.Root
              className="my-4 h-px bg-gray-100"
              orientation="horizontal"
            />
          )}
          <div className="mb-2">
            <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {section}
            </h3>
          </div>
          <ul className="space-y-0.5">
            {grouped[section].map((doc) => (
              <li key={doc.slug}>
                <NavLink
                  to={`/docs/${doc.slug}`}
                  className={cn(
                    "block rounded-md px-2 py-1.5 text-sm transition-colors",
                    doc.slug === currentSlug
                      ? "bg-gray-100 font-medium text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  )}
                >
                  {doc.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
