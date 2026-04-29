import { createInvalidateAllRouteHandler } from "@notion-headless-cms/adapter-next";
import { cms } from "@/app/lib/cms";

export const POST = createInvalidateAllRouteHandler(cms, {
  secret: process.env.REVALIDATE_SECRET ?? "",
});
