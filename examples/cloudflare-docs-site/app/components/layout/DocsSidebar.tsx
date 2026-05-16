import {
  BookOpen,
  ChevronRight,
  FileText,
  FlaskConical,
  Layers,
} from "lucide-react";
import { NavLink } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import type { Doc } from "~/generated/nhc";
import { cn } from "~/lib/utils";

const SECTION_ORDER = ["はじめに", "ガイド", "APIリファレンス", "レシピ"];

const SECTION_ICONS: Record<string, React.ElementType> = {
  "はじめに": BookOpen,
  "ガイド": Layers,
  "APIリファレンス": FileText,
  "レシピ": FlaskConical,
};

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
    <aside className="w-64 shrink-0 border-r border-border bg-sidebar px-3 py-6 overflow-y-auto">
      {visibleSections.map((section, sectionIndex) => {
        const SectionIcon = SECTION_ICONS[section] ?? FileText;
        return (
          <div key={section}>
            {sectionIndex > 0 && <Separator className="my-4" />}

            <div className="mb-1 flex items-center gap-1.5 px-2 py-1">
              <SectionIcon className="size-3.5 text-muted-foreground/60 shrink-0" />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                {section}
              </h3>
            </div>

            <ul className="space-y-0.5">
              {grouped[section].map((doc, i) => {
                const isActive = doc.slug === currentSlug;
                const isBeta = doc.status === "進行中";
                return (
                  <li
                    key={doc.slug}
                    style={{ animationDelay: `${(sectionIndex * 5 + i) * 25}ms` }}
                    className="animate-slide-in-left"
                  >
                    <NavLink
                      to={`/docs/${doc.slug}`}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        "border-l-2 pl-[6px]",
                        isActive
                          ? "border-primary bg-accent text-accent-foreground font-medium"
                          : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <span className="shrink-0 w-4 text-center text-sm leading-none">
                        {doc.iconEmoji ?? (
                          <ChevronRight
                            className={cn(
                              "size-3",
                              isActive
                                ? "text-foreground"
                                : "text-muted-foreground/40 group-hover:text-muted-foreground",
                            )}
                          />
                        )}
                      </span>
                      <span className="flex-1 truncate">{doc.name}</span>
                      {isBeta && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 text-[10px] py-0 px-1.5"
                        >
                          Beta
                        </Badge>
                      )}
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
