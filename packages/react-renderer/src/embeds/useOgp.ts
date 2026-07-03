"use client";

import { useEffect, useState } from "react";
import { useNotionContext } from "../context.js";
import type { OgCardData } from "./OgCard.js";

interface OgpEndpointResponse {
  ok: boolean;
  ogp?: OgCardData;
}

/**
 * ページアクセス時に `{ogpEndpoint}?url=...` から OGP メタデータを取得する。
 * `ogpEndpoint` が Context に無い場合・`url` が falsy（`block.ogp` を既に持つ場合に
 * 呼び出し側が渡す）な場合は何もしない。
 *
 * `@notion-headless-cms/cms` の `createOgpHandler()` が返す
 * `{ ok: boolean, ogp?: OgCardData }` 形式のレスポンスを期待する。
 */
export function useOgp(url: string | null | undefined): OgCardData | undefined {
  const { ogpEndpoint } = useNotionContext();
  const [ogp, setOgp] = useState<OgCardData | undefined>(undefined);

  useEffect(() => {
    if (!ogpEndpoint || !url) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${ogpEndpoint}?url=${encodeURIComponent(url)}`,
        );
        if (!res.ok) return;
        const body = (await res.json()) as OgpEndpointResponse;
        if (!cancelled && body.ok && body.ogp) setOgp(body.ogp);
      } catch {
        // 取得失敗時はシェル(シンプルなリンクカード)のまま。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ogpEndpoint, url]);

  return ogp;
}
