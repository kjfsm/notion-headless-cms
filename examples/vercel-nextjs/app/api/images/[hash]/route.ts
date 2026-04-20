import { createImageRouteHandler } from "@notion-headless-cms/adapter-next";
import { cms } from "../../../lib/cms";

export const GET = createImageRouteHandler(cms);
