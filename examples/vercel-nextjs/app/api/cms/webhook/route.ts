// Notion Webhook 受信ルート。cms.fetch() が署名検証 + debounce 付き同期キックを
// 内部で処理する。sync は debounce(既定3秒)後に非同期で走るため、レスポンス確定後も
// 処理を続けられる Next.js の after() で少し待ってから ISR キャッシュを掃く
// （Vercel の serverless 関数はレスポンス送信後にすぐ終了しうるため、
// fire-and-forget のバックグラウンド処理には after() が必須）。
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { getCms } from "@/app/lib/cms";

export async function POST(request: Request) {
  const response = await getCms().fetch(request);
  if (response.ok) {
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3500));
      revalidatePath("/");
      revalidatePath("/posts/[slug]", "page");
    });
  }
  return response;
}
