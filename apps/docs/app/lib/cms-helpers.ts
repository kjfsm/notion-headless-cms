import type { PageLinkMap } from "@notion-headless-cms/react-renderer";

/**
 * v3 の同期パイプラインは内部リンクの href を `/${collection}/${slug}` で固定生成する
 * （アプリ固有のルーティング規則を知らないため）。apps/docs は pages コレクションのみを
 * プレフィックス無し `/{slug}`（home は `/`）でルーティングするため、それに合わせて書き換える。
 */
export function remapPageLinks(links: PageLinkMap): PageLinkMap {
  return Object.fromEntries(
    Object.entries(links).map(([id, link]) => {
      const m = link.href.match(/^\/pages\/(.+)$/);
      const href = !m ? link.href : m[1] === "home" ? "/" : `/${m[1]}`;
      return [id, { ...link, href }];
    }),
  );
}
