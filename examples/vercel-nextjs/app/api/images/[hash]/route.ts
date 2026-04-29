import { createImageRouteHandler } from "@notion-headless-cms/adapter-next";
import { cms } from "@/app/lib/cms";

export const GET = createImageRouteHandler(cms);
