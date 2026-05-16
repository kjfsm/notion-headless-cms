import type { CodeBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Badge } from "../components/ui/badge.js";
import { Card, CardContent, CardHeader } from "../components/ui/card.js";
import { cn } from "../lib/utils";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

function plainText(
  richText: CodeBlockObjectResponse["code"]["rich_text"],
): string {
  return richText.map((rt) => rt.plain_text).join("");
}

/**
 * デフォルトの Code スタブ。bundle に shiki を混入させない。
 *
 * `notion-shiki` enricher によって `block.code.__cachedHtml` が付与されている場合は
 * `dangerouslySetInnerHTML` でそのまま描画する（バンドルに shiki 不要）。
 * `__cachedHtml` がない場合はソースを等幅フォントの `<pre>` で素のまま表示する。
 *
 * shiki で動的に整形表示したい場合は `@notion-headless-cms/react-renderer/code`
 * から SyntaxHighlighter を import し、`<NotionRenderer components={{ Code: SyntaxHighlighter }} />` で差し込む。
 */
export function Code({
  block,
  className,
}: BlockComponentProps<CodeBlockObjectResponse>) {
  // notion-shiki が fetch 時に付与した pre-rendered HTML があればそちらを使う
  const cachedHtml = (
    block.code as CodeBlockObjectResponse["code"] & { __cachedHtml?: string }
  ).__cachedHtml;

  const language = block.code.language;
  const source = cachedHtml ? null : plainText(block.code.rich_text);

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
              // biome-ignore lint/security/noDangerouslySetInnerHtml: notion-shiki の pre-render 済み出力
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
