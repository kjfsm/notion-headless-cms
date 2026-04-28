/** oEmbed プロトコルの最小限の実装。外部ライブラリなし・native fetch のみ使用。 */

export interface OembedData {
  type?: string;
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  html?: string;
  width?: number;
  height?: number;
}

/**
 * oEmbed エンドポイントを叩いてデータを返す。
 * HTTP エラー時は Error を投げる。
 */
export async function fetchOembed(
  url: string,
  endpoint: string,
  opts?: { width?: number; height?: number },
): Promise<OembedData> {
  const ep = new URL(endpoint);
  ep.searchParams.set("url", url);
  ep.searchParams.set("format", "json");
  if (opts?.width) ep.searchParams.set("maxwidth", String(opts.width));
  if (opts?.height) ep.searchParams.set("maxheight", String(opts.height));
  const res = await fetch(ep.toString());
  if (!res.ok) {
    throw new Error(
      `[notion-embed] oEmbed fetch failed: HTTP ${res.status} for ${url}`,
    );
  }
  return (await res.json()) as OembedData;
}

/** oEmbed の html フィールドに含まれる iframe の src 属性値を取り出す。 */
export function extractIframeSrc(html: string): string | null {
  const m = html.match(/\bsrc="([^"]+)"/);
  return m?.[1] ?? null;
}
