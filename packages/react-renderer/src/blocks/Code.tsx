import type { CodeBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

function plainText(
  richText: CodeBlockObjectResponse["code"]["rich_text"],
): string {
  return richText.map((rt) => rt.plain_text).join("");
}

export function Code({ block }: BlockComponentProps<CodeBlockObjectResponse>) {
  const language = block.code.language;
  const source = plainText(block.code.rich_text);

  return (
    <div className="my-3">
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
