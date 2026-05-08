import { createNextHandler } from "@notion-headless-cms/adapter-next";
import { cms } from "@/app/lib/cms";

const handler = createNextHandler(cms, {
  webhookSecret: process.env.REVALIDATE_SECRET ?? "",
});

export const GET = handler;
export const POST = handler;
