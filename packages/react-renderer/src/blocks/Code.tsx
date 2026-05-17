"use client";

import type { CodeBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
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
 * - `__cachedHtml`（notion-shiki が付与）があればそのまま使う（バンドルに shiki 不要）。
 * - それ以外は素の `<pre>` を出す。
 *
 * mermaid を SVG として描画したい場合は `@notion-headless-cms/react-renderer/mermaid`
 * の `MermaidCode` を `<NotionRenderer components={{ Code: MermaidCode }} />` で
 * 差し込む。mermaid は ~1 MB と重く CF Workers の 3 MiB 上限を直撃するため
 * 既定では含めない（opt-in）。
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

  return (
    <figure className={cn("my-3", className)}>
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-2">
          <Badge variant="secondary" className="font-mono text-xs">
            {language}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {cachedHtml ? (
            <div
              // biome-ignore lint/security/noDangerouslySetInnerHtml: notion-shiki の整形済み HTML
              dangerouslySetInnerHTML={{ __html: cachedHtml }}
            />
          ) : (
            <pre
              className="overflow-x-auto p-4 text-sm"
              data-language={language}
            >
              <code>{source}</code>
            </pre>
          )}
        </CardContent>
      </Card>
      {block.code.caption.length > 0 ? (
        <figcaption className="mt-1 text-xs text-muted-foreground">
          <RichText value={block.code.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}
