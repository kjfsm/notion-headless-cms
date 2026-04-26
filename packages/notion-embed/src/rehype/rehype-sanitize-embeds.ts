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

	return [rehypeRaw, [rehypeSanitize, schema]];
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
