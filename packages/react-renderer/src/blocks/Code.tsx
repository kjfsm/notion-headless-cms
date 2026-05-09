import type { CodeBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
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

  if (cachedHtml) {
    return (
      <figure className={cn("my-3", className)}>
        <div
          // biome-ignore lint/security/noDangerouslySetInnerHtml: notion-shiki の pre-render 済み出力
          dangerouslySetInnerHTML={{ __html: cachedHtml }}
        />
        {block.code.caption.length > 0 ? (
          <figcaption className="mt-1 text-xs text-muted-foreground">
            <RichText value={block.code.caption} />
          </figcaption>
        ) : null}
      </figure>
    );
  }

  const source = plainText(block.code.rich_text);
  return (
    <div className={cn("my-3", className)}>
      <pre
        className="overflow-x-auto rounded-lg bg-muted p-4 text-sm"
        data-language={language}
      >
        <code>{source}</code>
      </pre>
      {block.code.caption.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          <RichText value={block.code.caption} />
        </p>
      ) : null}
    </div>
  );
}
