import type { Element, ElementContent, Root, Text } from "hast";
import { visit } from "unist-util-visit";

/**
 * Notion enhanced markdown が含む独自タグを標準的な HTML 要素に変換する rehype プラグイン。
 *
 * 対象タグ (Notion API `GET /v1/pages/{id}/markdown` が出力するもの):
 * - `<callout icon color>` → `<div class="nhc-callout nhc-color-…">`
 * - `<span color underline>` → `<span class="nhc-color-…" data-underline>` (color 属性はブラウザ非対応)
 * - `<mention-page url>` → `<a href data-mention="page">`
 * - `<mention-date start [end]/>` → `<time datetime>` (range なら from–to を結合表示)
 * - `<page url>` / `<database url>` → `<a href data-link-type>` (リンク表現に統一)
 * - `<columns>` → `<div class="nhc-columns">`、`<column>` → `<div class="nhc-column">`
 * - `<file src>` → `<a href download>` (画像/動画系の判定はファイル拡張子で行う v1 では一律リンク)
 * - `<table_of_contents/>` → `<nav class="nhc-toc" data-placeholder>` (TOC 生成は別途)
 *
 * 未知の独自タグは class を付けるだけにしておく (除去すると内容が消えるため)。
 */
export function rehypeNotionTags() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      const name = node.tagName;
      switch (name) {
        case "callout":
          transformCallout(node);
          break;
        case "span":
          transformSpan(node);
          break;
        case "mention-page":
          transformMentionPage(node);
          break;
        case "mention-date":
          transformMentionDate(node);
          break;
        case "page":
          transformPageLink(node, "page");
          break;
        case "database":
          transformPageLink(node, "database");
          break;
        case "columns":
          node.tagName = "div";
          addClass(node, "nhc-columns");
          break;
        case "column":
          node.tagName = "div";
          addClass(node, "nhc-column");
          break;
        case "file":
          transformFile(node);
          break;
        case "table_of_contents":
          node.tagName = "nav";
          addClass(node, "nhc-toc");
          setAttr(node, "data-placeholder", "true");
          node.children = [];
          break;
        default:
          // 他の独自タグはそのまま (将来の Notion 拡張に備える)。
          if (name.includes("-")) addClass(node, `nhc-${name}`);
          break;
      }
    });
  };
}

function transformCallout(node: Element): void {
  const icon = getAttr(node, "icon");
  const color = getAttr(node, "color");
  node.tagName = "div";
  node.properties = { ...node.properties };
  delete node.properties.icon;
  delete node.properties.color;
  addClass(node, "nhc-callout");
  if (color) addClass(node, `nhc-color-${color}`);
  if (icon) {
    const iconEl: Element = {
      type: "element",
      tagName: "span",
      properties: { className: ["nhc-callout-icon"] },
      children: [{ type: "text", value: icon } satisfies Text],
    };
    const body: Element = {
      type: "element",
      tagName: "div",
      properties: { className: ["nhc-callout-body"] },
      children: node.children as ElementContent[],
    };
    node.children = [iconEl, body];
  }
}

function transformSpan(node: Element): void {
  const color = getAttr(node, "color");
  const underline = getAttr(node, "underline");
  // 標準でない属性は剥がしておかないと React/HTML 警告が出る。
  if (node.properties) {
    delete node.properties.color;
    delete node.properties.underline;
  }
  if (color) addClass(node, `nhc-color-${color}`);
  if (underline === "true") addClass(node, "nhc-underline");
}

function transformMentionPage(node: Element): void {
  const url = getAttr(node, "url");
  node.tagName = "a";
  node.properties = { className: ["nhc-mention", "nhc-mention-page"] };
  if (url) (node.properties as Record<string, unknown>).href = url;
  setAttr(node, "data-mention", "page");
}

function transformMentionDate(node: Element): void {
  const start = getAttr(node, "start");
  const end = getAttr(node, "end");
  node.tagName = "time";
  node.properties = { className: ["nhc-mention", "nhc-mention-date"] };
  if (start) (node.properties as Record<string, unknown>).dateTime = start;
  const label = end != null ? `${start} – ${end}` : (start ?? "");
  node.children = [{ type: "text", value: label } satisfies Text];
}

function transformPageLink(node: Element, kind: "page" | "database"): void {
  const url = getAttr(node, "url");
  node.tagName = "a";
  // children を保持して見出し相当のリンクにする。
  node.properties = { className: ["nhc-link", `nhc-link-${kind}`] };
  if (url) (node.properties as Record<string, unknown>).href = url;
  setAttr(node, "data-link-type", kind);
}

function transformFile(node: Element): void {
  const src = getAttr(node, "src");
  node.tagName = "a";
  node.properties = { className: ["nhc-file"] };
  if (src) {
    (node.properties as Record<string, unknown>).href = src;
    (node.properties as Record<string, unknown>).download = true;
  }
}

function getAttr(node: Element, name: string): string | undefined {
  const v = node.properties?.[name];
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.join(" ");
  return undefined;
}

function setAttr(node: Element, name: string, value: string): void {
  node.properties = { ...(node.properties ?? {}), [name]: value };
}

function addClass(node: Element, cls: string): void {
  if (!node.properties) node.properties = {};
  const props = node.properties;
  const current = props.className;
  if (Array.isArray(current)) {
    if (!current.includes(cls)) current.push(cls);
  } else if (typeof current === "string") {
    props.className = current ? `${current} ${cls}` : cls;
  } else {
    props.className = [cls];
  }
}
