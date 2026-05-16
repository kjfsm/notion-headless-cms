import { Link } from "react-router";
import { cn } from "~/lib/utils";

export function Header() {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-white",
        "border-[var(--border)]",
      )}
    >
      <div className="flex h-14 items-center px-6">
        <Link
          to="/"
          className="mr-6 flex items-center font-bold text-gray-900 hover:text-gray-700 transition-colors"
        >
          notion-headless-cms
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            to="/docs/installation"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            ドキュメント
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <a
            href="https://github.com/kjfsm/notion-headless-cms"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
