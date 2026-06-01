// Notion Webhook 受信ルート (M6 で追加された createNextWebhookHandler の例)。
//
// `POST /api/cms/webhook/posts` のように呼ばれ、ペイロードから決まる scope を見て
// 1) cms.invalidate(scope) で document/image キャッシュを掃く
// 2) revalidateTag / revalidatePath で Next.js ISR キャッシュも掃く
// を 1 リクエストで完結させる。
//
// 既存の `app/api/cms/[...path]/route.ts` は createNextHandler の low-level 経路として
// 残しているので、画像プロキシや他用途のキャッチオールが必要なら併用可能。
import { createNextWebhookHandler } from "@notion-headless-cms/client/next";
import { cms } from "@/app/lib/cms";

export const POST = createNextWebhookHandler(cms, {
  secret: process.env.REVALIDATE_SECRET,
  revalidate: (scope) => {
    if (scope === "all") {
      return { tags: ["nhc:all"], paths: ["/"] };
    }
    // collection ごとに tag を分ける運用 (revalidateTag(`nhc:${collection}`))。
    const collection =
      typeof scope === "object" && "collection" in scope
        ? scope.collection
        : undefined;
    const tags = collection ? [`nhc:${collection}`] : ["nhc:all"];
    const paths = collection ? [`/${collection}`] : ["/"];
    return { tags, paths };
  },
});
