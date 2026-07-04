// catch-all route。images/ogp/preview を cms.fetch() 1本に委譲する。
// webhook は revalidateTag/revalidatePath も呼びたいため、より具体的な
// app/api/cms/webhook/route.ts が Next.js のルーティング優先順位でこちらより優先される。
import { getCms } from "@/app/lib/cms";

export async function GET(request: Request) {
  return getCms().fetch(request);
}

export async function POST(request: Request) {
  return getCms().fetch(request);
}
