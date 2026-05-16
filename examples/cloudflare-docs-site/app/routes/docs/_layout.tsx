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
      <DocsSidebar docs={docs} currentSlug={slug} />
      <main className="flex-1 px-8 py-6 max-w-3xl">
        <Outlet />
      </main>
    </div>
  );
}
