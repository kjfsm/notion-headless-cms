import type { ContentBlock, InlineNode } from "@notion-headless-cms/core";

/**
 * Markdown 文字列から ContentBlock[] への軽量パーサー。
 *
 * 完璧を目指さず、よくあるパターン (heading / paragraph / list / code / quote / image / divider)
 * だけをハンドリングする。複雑な構造は `{ type: "raw", html }` にフォールバックする。
 *
 * notion-to-md の出力を想定。
 */
export function markdownToBlocks(markdown: string): ContentBlock[] {
  if (!markdown) return [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ContentBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) {
      i++;
      continue;
    }
    const trimmed = line.trim();

    // 空行スキップ
    if (trimmed === "") {
      i++;
      continue;
    }

    // 区切り線: --- or *** or ___
    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }

    // 見出し: # / ## / ### (h4 以上は paragraph に潰す)
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      const text = headingMatch[2];
      blocks.push({ type: "heading", level, children: parseInline(text) });
      i++;
      continue;
    }

    // コードブロック: ```lang\n...\n```
    const fenceMatch = trimmed.match(/^```(\S*)\s*$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? "")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      if (i < lines.length) i++; // 閉じ ```
      blocks.push({ type: "code", lang, value: codeLines.join("\n") });
      continue;
    }

    // 画像単体: ![alt](src)
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      blocks.push({ type: "image", alt: imgMatch[1], src: imgMatch[2] });
      i++;
      continue;
    }

    // 引用: > ...
    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test((lines[i] ?? "").trim())) {
        quoteLines.push((lines[i] ?? "").replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "quote",
        children: markdownToBlocks(quoteLines.join("\n")),
      });
      continue;
    }

    // リスト: - / * / + (unordered), 1. / 2. (ordered)
    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (ulMatch || olMatch) {
      const ordered = !!olMatch;
      const items: ContentBlock[][] = [];
      while (i < lines.length) {
        const cur = (lines[i] ?? "").trim();
        const cm = ordered
          ? cur.match(/^\d+\.\s+(.*)$/)
          : cur.match(/^[-*+]\s+(.*)$/);
        if (!cm) break;
        const text = cm[1];
        items.push([{ type: "paragraph", children: parseInline(text) }]);
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // 段落: 次の空行まで連結
    const paragraphLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const cur = lines[i] ?? "";
      if (cur.trim() === "") break;
      if (isBlockStart(cur.trim())) break;
      paragraphLines.push(cur);
      i++;
    }
    blocks.push({
      type: "paragraph",
      children: parseInline(paragraphLines.join(" ").trim()),
    });
  }

  return blocks;
}

function isBlockStart(trimmed: string): boolean {
  return (
    /^(#{1,3})\s+/.test(trimmed) ||
    /^```/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^[-*+]\s+/.test(trimmed) ||
    /^\d+\.\s+/.test(trimmed) ||
    /^([-*_])\1{2,}$/.test(trimmed)
  );
}

/**
 * インラインテキストのパース。
 * **bold**, *italic*, `code`, [text](url) に対応。
 */
function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let i = 0;

  while (i < text.length) {
    // リンク [text](url)
    if (text[i] === "[") {
      const end = text.indexOf("]", i);
      if (end !== -1 && text[end + 1] === "(") {
        const close = text.indexOf(")", end + 2);
        if (close !== -1) {
          const linkText = text.slice(i + 1, end);
          const url = text.slice(end + 2, close);
          nodes.push({
            type: "link",
            url,
            children: parseInline(linkText),
          });
          i = close + 1;
          continue;
        }
      }
    }

    // コード `code`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        nodes.push({ type: "text", value: text.slice(i + 1, end), code: true });
        i = end + 1;
        continue;
      }
    }

    // 太字 **bold**
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        nodes.push({ type: "text", value: text.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }

    // 斜体 *italic*
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        nodes.push({
          type: "text",
          value: text.slice(i + 1, end),
          italic: true,
        });
        i = end + 1;
        continue;
      }
    }

    // プレーンテキスト (次の特殊文字まで)
    let j = i;
    while (j < text.length && !"[`*".includes(text[j] ?? "")) j++;
    if (j > i) {
      nodes.push({ type: "text", value: text.slice(i, j) });
      i = j;
    } else {
      // 特殊文字だが閉じ括弧が無かったケース: 1 文字だけ消費
      nodes.push({ type: "text", value: text[i] ?? "" });
      i++;
    }
  }

  return nodes;
}
