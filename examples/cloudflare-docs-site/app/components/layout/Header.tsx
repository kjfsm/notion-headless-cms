import { SiGithub } from "@icons-pack/react-simple-icons";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export function Header() {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        "border-b border-border/60 bg-background/80 backdrop-blur-sm",
      )}
    >
      <div className="flex h-14 items-center px-6">
        <Link
          to="/"
          className="mr-8 flex items-center gap-2 font-semibold text-foreground hover:opacity-80 transition-opacity"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-foreground text-background text-xs font-bold">
            N
          </span>
          notion-headless-cms
        </Link>

        <nav className="flex items-center">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/docs/installation">ドキュメント</Link>
          </Button>
        </nav>

        <div className="ml-auto">
          <Button variant="ghost" size="icon" asChild>
            <a
              href="https://github.com/kjfsm/notion-headless-cms"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
            >
              <SiGithub className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
