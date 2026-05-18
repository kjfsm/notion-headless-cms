// Cloudflare Workers のランタイムシークレット・環境変数。
// `wrangler secret put` 系で投入する値は `wrangler types` の生成物には現れないため、ここで宣言マージする。
// wrangler types の生成形式によっては global Env が Cloudflare.Env を継承しないため、両方に追加する。
declare global {
  namespace Cloudflare {
    interface Env {
      NOTION_TOKEN: string;
      /** Notion Webhook 署名検証用シークレット。/api/revalidate を有効化する場合のみ設定。 */
      NOTION_WEBHOOK_SECRET?: string;
      /** ドキュメント / ページ キャッシュ用 KV namespace（任意）。 */
      DOC_CACHE?: KVNamespace;
    }
  }
  interface Env {
    NOTION_TOKEN: string;
    NOTION_WEBHOOK_SECRET?: string;
    DOC_CACHE?: KVNamespace;
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
