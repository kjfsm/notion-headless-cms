// このファイルは `@notion-headless-cms/react-renderer/code` サブパスとして公開する。
// `shiki` を static import するためメイン `index.ts` からは到達させない。
// shiki をブラウザバンドルに含めてよい場合のみこのサブパスを使う。
// バンドルサイズを抑えたい本番用途は `@notion-headless-cms/notion-shiki` enricher が推奨。
"use client";

import type { CodeBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Suspense, use } from "react";
import { createHighlighter } from "shiki";
import { cn } from "./lib/utils.js";
import type { BlockComponentProps } from "./types.js";

function plainText(
  richText: CodeBlockObjectResponse["code"]["rich_text"],
): string {
  return richText.map((rt) => rt.plain_text).join("");
}

// モジュールスコープで Highlighter を初期化（シングルトン）。
// React の `use()` に渡すことで Suspense と統合する。
const highlighterPromise = createHighlighter({
  themes: ["github-dark", "github-light"],
  langs: [
    "bash",
    "c",
    "cpp",
    "css",
    "docker",
    "go",
    "graphql",
    "html",
    "java",
    "javascript",
    "json",
    "kotlin",
    "markdown",
    "php",
    "python",
    "ruby",
    "rust",
    "scss",
    "shell",
    "sql",
    "swift",
    "toml",
    "tsx",
    "typescript",
    "xml",
    "yaml",
  ],
});

function SyntaxHighlighterInner({
  block,
  className,
}: BlockComponentProps<CodeBlockObjectResponse>) {
  const highlighter = use(highlighterPromise);
  const source = plainText(block.code.rich_text);
  const lang = block.code.language;

  let html: string;
  try {
    html = highlighter.codeToHtml(source, { lang, theme: "github-dark" });
  } catch {
    return (
      <CodeFallback
        source={source}
        lang={lang}
        className={className}
        caption={block.code.caption}
      />
    );
  }

  return (
    <figure className={cn("my-3", className)}>
      <div
        // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki 出力は信頼できる
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {block.code.caption.length > 0 ? (
        <figcaption className="mt-1 text-xs text-muted-foreground">
          {block.code.caption.map((rt) => rt.plain_text).join("")}
        </figcaption>
      ) : null}
    </figure>
  );
}

function CodeFallback({
  source,
  lang,
  className,
  caption,
}: {
  source: string;
  lang: string;
  className?: string;
  caption: CodeBlockObjectResponse["code"]["caption"];
}) {
  return (
    <div className={cn("my-3", className)}>
      <pre
        className="overflow-x-auto rounded-lg bg-muted p-4 text-sm"
        data-language={lang}
      >
        <code>{source}</code>
      </pre>
      {caption.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {caption.map((rt) => rt.plain_text).join("")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * shiki を使ってコードブロックをシンタックスハイライトするコンポーネント。
 * Highlighter の初期化を React 19 の `use()` + Suspense で非同期処理する。
 *
 * バンドルサイズが問題になる場合は `notion-shiki` enricher を使うことで
 * shiki をブラウザバンドルから完全に除外できる。
 *
 * @example
 * ```tsx
 * import dynamic from "next/dynamic";
 * const Code = dynamic(() =>
 *   import("@notion-headless-cms/react-renderer/code").then((m) => m.SyntaxHighlighter),
 * );
 * <NotionRenderer blocks={blocks} components={{ Code }} />;
 * ```
 */
export function SyntaxHighlighter(
  props: BlockComponentProps<CodeBlockObjectResponse>,
) {
  const source = plainText(props.block.code.rich_text);
  const lang = props.block.code.language;
  return (
    <Suspense
      fallback={
        <CodeFallback
          source={source}
          lang={lang}
          className={props.className}
          caption={props.block.code.caption}
        />
      }
    >
      <SyntaxHighlighterInner {...props} />
    </Suspense>
  );
}
