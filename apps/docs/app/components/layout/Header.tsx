import { SiGithub } from "@icons-pack/react-simple-icons";
import { Link } from "react-router";

// バンドサイトと同じ「sticky + すりガラス + 太字ワードマーク」。
// ロゴは font-black tracking-tighter、ホバーで purple-600 に振る。
export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="flex h-14 items-center px-6">
        <Link
          to="/"
          className="mr-8 text-base font-black tracking-tighter text-gray-900 transition hover:text-purple-600"
        >
          NOTION-HEADLESS-CMS
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            to="/docs"
            className="text-sm font-medium text-gray-500 transition hover:text-purple-600"
          >
            ドキュメント
          </Link>
        </nav>

        <div className="ml-auto">
          <a
            href="https://github.com/kjfsm/notion-headless-cms"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="inline-flex size-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-purple-600"
          >
            <SiGithub className="size-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
