import { createRevalidateRouteHandler } from "@notion-headless-cms/adapter-next";
import { cms } from "../../lib/cms";

export const POST = createRevalidateRouteHandler(cms, {
  secret: process.env.REVALIDATE_SECRET ?? "",
});
