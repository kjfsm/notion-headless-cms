import type { ContentBlock, InlineNode } from "@notion-headless-cms/core";

/**
 * notion-to-md が出力する Markdown を ContentBlock[] へ変換する軽量パーサー。
 *
 * 完璧な CommonMark 互換は目指さず、Notion の出力で出現するパターン
 * (heading / paragraph / list / code / quote / image / divider) のみ扱う。
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

    if (trimmed === "") {
      i++;
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }

    // h4 以上は ContentBlock の heading level (1|2|3) に収まらないため paragraph に倒す
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1]?.length as 1 | 2 | 3;
      const text = headingMatch[2] ?? "";
      blocks.push({ type: "heading", level, children: parseInline(text) });
      i++;
      continue;
    }

    const fenceMatch = trimmed.match(/^```(\S*)\s*$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? "")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ type: "code", lang, value: codeLines.join("\n") });
      continue;
    }

    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      blocks.push({
        type: "image",
        alt: imgMatch[1] ?? "",
        src: imgMatch[2] ?? "",
      });
      i++;
      continue;
    }

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
        const text = cm[1] ?? "";
        items.push([{ type: "paragraph", children: parseInline(text) }]);
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // 段落は次の空行 or 別ブロック開始まで連結する
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

/** `**bold**`, `*italic*`, `` `code` ``, `[text](url)` の最小サブセットだけサポートする。 */
function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let i = 0;

  while (i < text.length) {
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

    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        nodes.push({ type: "text", value: text.slice(i + 1, end), code: true });
        i = end + 1;
        continue;
      }
    }

    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        nodes.push({ type: "text", value: text.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }

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

    // 次の特殊文字までを 1 つの text ノードにまとめる
    let j = i;
    while (j < text.length && !"[`*".includes(text[j] ?? "")) j++;
    if (j > i) {
      nodes.push({ type: "text", value: text.slice(i, j) });
      i = j;
    } else {
      // 特殊文字で始まったが閉じが見つからなかった: 文字通りに 1 字だけ消費して進める
      nodes.push({ type: "text", value: text[i] ?? "" });
      i++;
    }
  }

  return nodes;
}
