"use client";

import type { CodeBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { CodeCollapsibleWrapper } from "../components/code-collapsible-wrapper.js";
import { CopyButton } from "../components/copy-button.js";
import { Badge } from "../components/ui/badge.js";
import { cn } from "../lib/utils.js";
import type { BlockComponentProps } from "../types.js";

/** これを超える行数のコードは折りたたみ表示にする。 */
const COLLAPSE_LINE_THRESHOLD = 20;

function plainText(
  richText: CodeBlockObjectResponse["code"]["rich_text"],
): string {
  return richText.map((rt) => rt.plain_text).join("");
}

function normalizeLanguage(lang: string): string {
  const l = lang.trim().toLowerCase();
  if (l === "" || l === "plain text" || l === "plain_text") return "text";
  return lang;
}

/**
 * デフォルトの Code 描画。shadcn docs 風の枠（ヘッダー: ファイル名 + 言語ラベル +
 * コピーボタン、本体: シンタックスハイライト）。
 *
 * - `__cachedHtml`（`@notion-headless-cms/notion-shiki` の `highlightCodeBlocks` が
 *   表示前に付与する rehype-pretty-code 出力）があればそれを描画する。バンドルに
 *   shiki を含めずに済む。
 * - 無ければ行番号付きの素の `<pre>` にフォールバックする。
 * - 行数が多いコードは折りたたむ。
 *
 * mermaid を SVG として描画したい場合は `@notion-headless-cms/react-renderer/mermaid`
 * の `MermaidCode` を `<NotionRenderer components={{ Code: MermaidCode }} />` で差し込む。
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
  const fileName = plainText(block.code.caption);
  const lines = source.split("\n");

  const figure = (
    <div
      className={cn(
        "nhc-code group/code my-4 overflow-hidden rounded-xl border bg-card text-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {fileName ? (
            <span className="truncate font-mono text-xs text-muted-foreground">
              {fileName}
            </span>
          ) : null}
          <Badge variant="secondary" className="font-mono text-xs">
            {language}
          </Badge>
        </div>
        <CopyButton value={source} className="-mr-2 shrink-0" />
      </div>
      {cachedHtml ? (
        <div
          className="nhc-code__content"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: notion-shiki の整形済み HTML
          dangerouslySetInnerHTML={{ __html: cachedHtml }}
        />
      ) : (
        <pre data-language={language}>
          <code data-line-numbers="">
            {lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: コード行は静的で並び替えされない
              <span key={`${block.id}:${i}`} data-line="">
                {line === "" ? "​" : line}
              </span>
            ))}
          </code>
        </pre>
      )}
    </div>
  );

  if (lines.length > COLLAPSE_LINE_THRESHOLD) {
    return <CodeCollapsibleWrapper>{figure}</CodeCollapsibleWrapper>;
  }
  return figure;
}
