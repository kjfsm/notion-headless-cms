// Cloudflare Workers のランタイムシークレット・環境変数。
// NOTION_TOKEN は wrangler secret put で設定する（wrangler types では生成されない）。
declare global {
  namespace Cloudflare {
    interface Env {
      NOTION_TOKEN: string;
      NOTION_DATA_SOURCE_ID: string;
    }
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
