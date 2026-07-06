// Cloudflare Workers のランタイムシークレット・環境変数。
// `wrangler secret put` 系で投入する値は `wrangler types` の生成物には現れないため、ここで宣言マージする。
// wrangler types の生成形式によっては global Env が Cloudflare.Env を継承しないため、両方に追加する。
declare global {
  namespace Cloudflare {
    interface Env {
      NOTION_TOKEN: string;
      /** Notion Webhook 署名検証用シークレット。webhook を有効化する場合のみ設定。 */
      NOTION_WEBHOOK_SECRET?: string;
      /** ドキュメント / ページ インデックス用 D1 database。 */
      DB: D1Database;
      /** Notion API アクセスを直列化する同期コーディネータ DO。 */
      SYNC_COORDINATOR: DurableObjectNamespace;
    }
  }
  interface Env {
    NOTION_TOKEN: string;
    NOTION_WEBHOOK_SECRET?: string;
    DB: D1Database;
    SYNC_COORDINATOR: DurableObjectNamespace;
  }
}

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

export {};
