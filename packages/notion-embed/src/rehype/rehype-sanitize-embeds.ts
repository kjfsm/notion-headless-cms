import type { Schema } from "hast-util-sanitize";
import type { PluggableList } from "unified";
import type { EmbedProvider } from "../types";

export interface EmbedRehypePluginsOptions {
  /** 登録する provider 配列。各 provider の sanitizeSchema をマージする。 */
  providers?: readonly EmbedProvider[];
  /** ユーザーが追加で許可したいスキーマ。provider スキーマとマージされる。 */
  extendSchema?: Schema;
}

/**
 * rehype-raw + rehype-sanitize を合わせて返す。
 * renderer の rehypePlugins に渡すだけで、notionEmbed が出力する HTML が
 * サニタイズ通過できるようになる。
 *
 * provider ごとの sanitizeSchema を内部でマージするため、
 * provider 追加 = sanitize 拡張 = レンダー可能になる。
 */
export async function embedRehypePlugins(
  opts?: EmbedRehypePluginsOptions,
): Promise<PluggableList> {
  const [rehypeRaw, rehypeSanitize, { defaultSchema }] = await Promise.all([
    import("rehype-raw").then((m) => m.default),
    import("rehype-sanitize").then((m) => m.default),
    import("hast-util-sanitize"),
  ]);

  const schema = buildSchema(
    opts?.providers ?? [],
    opts?.extendSchema,
    defaultSchema,
  );

  return [rehypeRaw, rehypeAddToggleClasses, [rehypeSanitize, schema]];
}

/**
 * notion-to-md が生成する <details><summary> にCSSクラスを付与するプラグイン。
 * rehype-sanitize より前に実行し、className が sanitize を通過できるようにする。
 */
function rehypeAddToggleClasses() {
  return visitDetails;
}

type HastNode = {
  type: string;
  children?: HastNode[];
  tagName?: string;
  properties?: Record<string, unknown>;
};

function visitDetails(node: HastNode): void {
  if (!node.children) return;
  for (const child of node.children) {
    if (child.type !== "element") continue;
    if (child.tagName === "details") {
      child.properties = child.properties ?? {};
      const existing = child.properties.className;
      if (!Array.isArray(existing) || !existing.includes("nhc-toggle")) {
        child.properties.className = Array.isArray(existing)
          ? ["nhc-toggle", ...existing]
          : ["nhc-toggle"];
      }
      // details の直接の子 summary にクラスを付与
      if (child.children) {
        for (const grandchild of child.children) {
          if (
            grandchild.type === "element" &&
            grandchild.tagName === "summary"
          ) {
            grandchild.properties = grandchild.properties ?? {};
            const gc = grandchild.properties.className;
            if (!Array.isArray(gc) || !gc.includes("nhc-toggle__summary")) {
              grandchild.properties.className = Array.isArray(gc)
                ? ["nhc-toggle__summary", ...gc]
                : ["nhc-toggle__summary"];
            }
          }
        }
      }
    }
    visitDetails(child);
  }
}

function buildSchema(
  providers: readonly EmbedProvider[],
  extra: Schema | undefined,
  base: Schema,
): Schema {
  let merged = deepMergeSchema(base, notionEmbedBaseSchema());
  for (const p of providers) {
    if (p.sanitizeSchema) {
      merged = deepMergeSchema(merged, p.sanitizeSchema);
    }
  }
  if (extra) {
    merged = deepMergeSchema(merged, extra);
  }
  return merged;
}

/**
 * notionEmbed が共通で出力する HTML 要素を許可するための基本スキーマ。
 * (bookmark / link_preview / mention / callout / toggle など共通部分)
 *
 * 重要: HAST は HTML の `class` 属性を `className` プロパティとして持つため、
 * sanitize 用のキーは `className` を使う。
 * また defaultSchema は `a` などに `["className", "data-footnote-backref"]` のような
 * 値制限付きエントリを入れているため、無制限な `"className"` をエントリ先頭に置いて
 * 我々のクラス名を通せるよう deepMergeSchema 側で「先頭に prepend」する。
 */
function notionEmbedBaseSchema(): Schema {
  return {
    tagNames: [
      "a",
      "p",
      "div",
      "span",
      "figure",
      "figcaption",
      "img",
      "video",
      "audio",
      "source",
      "iframe",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "strong",
      "em",
      "s",
      "u",
      "code",
      "pre",
      "details",
      "summary",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "label",
      "input",
      "hr",
    ],
    attributes: {
      a: ["className", "href", "target", "rel"],
      // defaultSchema は code: [['className', /^language-./]] で language-* のみ許可するため
      // 先頭に無制限な "className" を追加して nhc-inline-code 等を通す
      code: ["className"],
      img: [
        "className",
        "src",
        "alt",
        "loading",
        "width",
        "height",
        "itemProp",
      ],
      video: ["className", "src", "controls", "width", "height"],
      audio: ["className", "src", "controls"],
      source: ["src", "type"],
      iframe: [
        "className",
        "src",
        "width",
        "height",
        "frameBorder",
        "allowFullScreen",
        "allow",
        "loading",
      ],
      input: ["type", "disabled", "checked"],
      "*": ["className", "ariaHidden"],
      th: ["scope", "colSpan", "rowSpan"],
      td: ["colSpan", "rowSpan"],
    },
    protocols: {
      href: ["https", "http", "mailto"],
      src: ["https", "http"],
    },
    strip: ["script", "style"],
    clobber: [],
  };
}

function deepMergeSchema(base: Schema, override: Schema): Schema {
  const merged: Schema = { ...base };

  if (override.tagNames) {
    merged.tagNames = unique([...(base.tagNames ?? []), ...override.tagNames]);
  }

  if (override.attributes) {
    merged.attributes = { ...(base.attributes ?? {}) };
    for (const [tag, attrs] of Object.entries(override.attributes)) {
      const existing = merged.attributes[tag];
      if (Array.isArray(existing)) {
        // override を先頭に置く: hast-util-sanitize は findDefinition で
        // 最初に key 一致したエントリを採用するため、無制限な "className" を
        // defaultSchema の値制限付きエントリより先に評価させる必要がある。
        merged.attributes[tag] = unique([...(attrs as string[]), ...existing]);
      } else {
        merged.attributes[tag] = attrs;
      }
    }
  }

  if (override.protocols) {
    merged.protocols = { ...(base.protocols ?? {}) };
    for (const [attr, protos] of Object.entries(override.protocols)) {
      const existing = (merged.protocols as Record<string, string[]>)[attr];
      (merged.protocols as Record<string, string[]>)[attr] = existing
        ? unique([...existing, ...(protos as string[])])
        : (protos as string[]);
    }
  }

  if (override.strip) {
    merged.strip = unique([...(base.strip ?? []), ...override.strip]);
  }

  return merged;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
