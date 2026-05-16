import { Outlet, useParams } from "react-router";
import { DocsSidebar } from "~/components/layout/DocsSidebar";
import { makeCms } from "~/lib/cms";
import type { Route } from "./+types/_layout";

export async function loader({ context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const docs = await cms.docs.list();
  return { docs };
}

export default function DocsLayout({ loaderData }: Route.ComponentProps) {
  const { docs } = loaderData;
  const { slug } = useParams();

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <div className="sticky top-14 h-[calc(100vh-3.5rem)] shrink-0">
        <DocsSidebar docs={docs} currentSlug={slug} />
      </div>
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-3xl px-8 py-10 animate-fade-in-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
