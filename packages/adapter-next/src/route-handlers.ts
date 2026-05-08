import type { CMSGlobalOps } from "@notion-headless-cms/core";

export interface NextHandlerOptions {
  /** Webhook 検証用シークレット。Authorization ヘッダと照合する。 */
  webhookSecret?: string;
}

/**
 * Next.js App Router 向けの統合ルートハンドラを生成する。
 * 画像プロキシ (`GET /api/cms/images/[hash]`) と
 * Webhook による invalidate (`POST /api/cms/...`) を1つのハンドラで処理する。
 *
 * @example
 * // app/api/cms/[...path]/route.ts
 * import { cms } from "@/lib/cms";
 * import { createNextHandler } from "@notion-headless-cms/adapter-next";
 *
 * const handler = createNextHandler(cms, { webhookSecret: process.env.WEBHOOK_SECRET });
 * export const GET = handler;
 * export const POST = handler;
 */
export function createNextHandler(
  cms: CMSGlobalOps,
  opts?: NextHandlerOptions,
): (req: Request) => Promise<Response> {
  return cms.handler({ webhookSecret: opts?.webhookSecret });
}
