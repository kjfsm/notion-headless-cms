"use client";

import type { CodeBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { useEffect, useId, useState } from "react";
import { Badge } from "../components/ui/badge.js";
import { Card, CardContent, CardHeader } from "../components/ui/card.js";
import { cn } from "../lib/utils.js";
import { RichText } from "../rich-text/RichText.js";
import type { BlockComponentProps } from "../types.js";

function plainText(
  richText: CodeBlockObjectResponse["code"]["rich_text"],
): string {
  return richText.map((rt) => rt.plain_text).join("");
}

// `"plain text"` 等の Notion 言語名を Shiki/Prism で扱いやすい形に揃える。
function normalizeLanguage(lang: string): string {
  const l = lang.trim().toLowerCase();
  if (l === "" || l === "plain text" || l === "plain_text") return "text";
  return lang;
}

/**
 * デフォルトの Code 描画。
 * - `language === "mermaid"`：クライアントで `mermaid` を動的 import して SVG にする。
 * - `__cachedHtml`（notion-shiki が付与）があればそのまま使う（バンドルに shiki 不要）。
 * - それ以外は素の `<pre>` を出す。
 */
export function Code({
  block,
  className,
}: BlockComponentProps<CodeBlockObjectResponse>) {
  const cachedHtml = (
    block.code as CodeBlockObjectResponse["code"] & { __cachedHtml?: string }
  ).__cachedHtml;
  const language = normalizeLanguage(block.code.language);
  const source = plainText(block.code.rich_text);

  const isMermaid = language === "mermaid";
  const mermaidSvg = useMermaidSvg(isMermaid ? source : null);

  let body: React.ReactNode;
  if (isMermaid && mermaidSvg) {
    body = (
      <div
        className="flex justify-center p-4"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid 由来 SVG
        dangerouslySetInnerHTML={{ __html: mermaidSvg }}
      />
    );
  } else if (!isMermaid && cachedHtml) {
    body = (
      <div
        // biome-ignore lint/security/noDangerouslySetInnerHtml: notion-shiki の整形済み HTML
        dangerouslySetInnerHTML={{ __html: cachedHtml }}
      />
    );
  } else {
    body = (
      <pre className="overflow-x-auto p-4 text-sm" data-language={language}>
        <code>{source}</code>
      </pre>
    );
  }

  return (
    <figure className={cn("my-3", className)}>
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-2">
          <Badge variant="secondary" className="font-mono text-xs">
            {language}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">{body}</CardContent>
      </Card>
      {block.code.caption.length > 0 ? (
        <figcaption className="mt-1 text-xs text-muted-foreground">
          <RichText value={block.code.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}

/** mermaid を動的 import で読み込み SVG 文字列を返す。失敗時は null（呼び側はコードで fallback）。 */
function useMermaidSvg(source: string | null): string | null {
  const reactId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    if (!source) {
      setSvg(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // mermaid は optional peer。未インストールでも catch でフォールバックする。
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
        // mermaid.render の id は英数字制約があるので reactId を正規化。
        const id = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
        const { svg } = await mermaid.render(id, source);
        if (!cancelled) setSvg(svg);
      } catch {
        // peer に mermaid が無いか render 失敗時はコードフォールバック。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, reactId]);
  return svg;
}
