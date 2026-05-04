"use client";

import type { CodeBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps } from "../types";

// Notion の言語名と shiki の言語識別子のずれを補正するマップ。
// shiki が知らない言語は plaintext にフォールバック。
const LANG_MAP: Record<string, string> = {
  "plain text": "plaintext",
  shell: "bash",
  "shell session": "bash",
  "objective-c": "objc",
};

function plainText(
  richText: CodeBlockObjectResponse["code"]["rich_text"],
): string {
  return richText.map((rt) => rt.plain_text).join("");
}

export function Code({ block }: BlockComponentProps<CodeBlockObjectResponse>) {
  const language = LANG_MAP[block.code.language] ?? block.code.language;
  const source = plainText(block.code.rich_text);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    codeToHtml(source, {
      lang: language,
      theme: "github-dark",
    })
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [language, source]);

  return (
    <div className="my-3">
      {html ? (
        // shiki は安全な HTML を生成するため dangerouslySetInnerHTML で取り込む
        <div
          className="overflow-x-auto rounded-lg text-sm [&_pre]:p-4"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki 出力は信頼できる
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
          <code>{source}</code>
        </pre>
      )}
      {block.code.caption.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          <RichText value={block.code.caption} />
        </p>
      ) : null}
    </div>
  );
}
