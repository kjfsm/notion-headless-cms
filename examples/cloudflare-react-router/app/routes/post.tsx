import {
  type BlockComponentProps,
  type NotionBlock,
  NotionRenderer,
} from "@notion-headless-cms/react-renderer";
// 数式ブロックを KaTeX で整形描画するために `./equation` サブパスから直接 import する。
// React Router 7 の SSR ではルート単位でコード分割されるため、ここで static import しても
// 数式を含まないページのバンドルには入らない。
import { Equation as KatexEquation } from "@notion-headless-cms/react-renderer/equation";
import { resolveBlockImageUrls } from "@notion-headless-cms/react-renderer/server";
import type { ComponentType } from "react";
import { data } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/post";

// ComponentOverrides は broad な BlockObjectResponse 型を取るため、narrow な
// `EquationBlockObjectResponse` を受ける KatexEquation はキャストして渡す。
// （DX 改善は kjfsm/notion-headless-cms#217 で追跡）
const Equation = KatexEquation as unknown as ComponentType<BlockComponentProps>;

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env);
  const post = await cms.posts.find(params.slug ?? "");
  if (!post) throw data("Not Found", { status: 404 });
  // notionBlocks() は cms (R2 + KV) キャッシュ経由で取得され、
  // 画像 URL は cms.cacheImage で R2 プロキシへ事前解決される。
  const notionBlocks =
    ((await post.notionBlocks()) as NotionBlock[] | undefined) ?? [];
  const blocks = await resolveBlockImageUrls(notionBlocks, cms.cacheImage);
  // ItemWithContent には html() / blocks() などのメソッドが生えており、
  // React Router の serializer はそれを転送できないため、必要なフィールドだけ抜き出す。
  return {
    blocks,
    item: {
      slug: post.slug,
      title: post.title,
      publishedAt: post.publishedAt,
    },
  };
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { blocks, item } = loaderData;
  return (
    <article>
      <h1>{item.title ?? item.slug}</h1>
      {item.publishedAt && <time>{item.publishedAt}</time>}
      <NotionRenderer blocks={blocks} components={{ Equation }} />
    </article>
  );
}
