"use client";

import type { CodeBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { useEffect, useState } from "react";
import { CodeCollapsibleWrapper } from "../components/code-collapsible-wrapper.js";
import { CopyButton } from "../components/copy-button.js";
import { Badge } from "../components/ui/badge.js";
import { cn } from "../lib/utils.js";
import type { BlockComponentProps } from "../types.js";

/** これを超える行数のコードは折りたたみ表示にする。 */
const COLLAPSE_LINE_THRESHOLD = 20;

// DO/Worker 側のシンタックスハイライトはページアクセス時ではなく同期時に CPU を
// 消費するため、既定はここでのクライアント遅延ハイライトにする。ハイライタは
// モジュールスコープで再利用し、複数コードブロックがあっても 1 度だけロードする。
let highlighterPromise: Promise<{
  codeToHtml(code: string, options: Record<string, unknown>): string;
  loadLanguage(lang: string): Promise<void>;
  getLoadedLanguages(): string[];
} | null> | null = null;

async function loadHighlighter() {
  try {
    const shiki = await import("shiki");
    const { createJavaScriptRegexEngine } = await import(
      "shiki/engine/javascript"
    );
    return (await shiki.createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    })) as unknown as {
      codeToHtml(code: string, options: Record<string, unknown>): string;
      loadLanguage(lang: string): Promise<void>;
      getLoadedLanguages(): string[];
    };
  } catch {
    // shiki 未インストール時は素の <pre> フォールバックのまま。
    return null;
  }
}

async function highlightClientSide(
  source: string,
  language: string,
): Promise<string | null> {
  highlighterPromise ??= loadHighlighter();
  const highlighter = await highlighterPromise;
  if (!highlighter) return null;
  let lang = language;
  if (!highlighter.getLoadedLanguages().includes(lang)) {
    try {
      await highlighter.loadLanguage(lang);
    } catch {
      lang = "text";
    }
  }
  try {
    return highlighter.codeToHtml(source, {
      lang,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
      transformers: [
        {
          pre(node: { properties: Record<string, unknown> }) {
            node.properties.style = undefined;
          },
          code(node: { properties: Record<string, unknown> }) {
            node.properties["data-line-numbers"] = "";
          },
          line(node: { properties: Record<string, unknown> }) {
            node.properties["data-line"] = "";
          },
        },
      ],
    });
  } catch {
    return null;
  }
}

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
 * - `__cachedHtml`（`@notion-headless-cms/cms` の `createShikiTransform` 等が同期時に
 *   付与する事前ハイライト済み HTML）があればそれを最優先で描画する
 * - 無ければクライアント水和後に `shiki` を動的 import してハイライトする
 *   （Worker の CPU 予算を消費しない既定経路。`shiki` が peer として無ければスキップ）
 * - どちらも使えない場合は行番号付きの素の `<pre>` にフォールバックする
 * - 行数が多いコードは折りたたむ
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
  const [clientHtml, setClientHtml] = useState<string | null>(null);

  useEffect(() => {
    if (cachedHtml) return;
    let cancelled = false;
    highlightClientSide(source, language).then((html) => {
      if (!cancelled && html) setClientHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [cachedHtml, source, language]);

  const html = cachedHtml ?? clientHtml;

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
      {html ? (
        <div
          className="nhc-code__content"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki の整形済み HTML
          dangerouslySetInnerHTML={{ __html: html }}
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
