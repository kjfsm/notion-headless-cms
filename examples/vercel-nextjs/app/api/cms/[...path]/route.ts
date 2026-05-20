// catch-all route。`/api/cms/images/:hash` と `/api/cms/revalidate` の両方を
// `createNextHandler(cms)` が引き受ける。
//
// ※ 画像プロキシをカスタマイズしたい場合は `images/[hash]/route.ts` を参照。
// Next.js の優先順位により、具体パスのほうがこの catch-all より優先される。
import { createNextHandler } from "@notion-headless-cms/next";
import { cms } from "@/app/lib/cms";

const handler = createNextHandler(cms, {
  webhookSecret: process.env.REVALIDATE_SECRET ?? "",
});

export const GET = handler;
export const POST = handler;
