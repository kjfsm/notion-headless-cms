import { describe, expect, it } from "vitest";
import { defineEmbedProvider } from "../../providers/index";
import { embedRehypePlugins } from "../../rehype/rehype-sanitize-embeds";

describe("embedRehypePlugins", () => {
	it("2 要素のプラグインリストを返す (rehype-raw と rehype-sanitize)", async () => {
		const plugins = await embedRehypePlugins();
		expect(plugins).toHaveLength(2);
	});

	it("provider の sanitizeSchema が iframe を許可する", async () => {
		const steamProvider = defineEmbedProvider({
			id: "steam",
			match: (url) => url.includes("steampowered.com"),
			render: () => ({ kind: "html", html: "" }),
			sanitizeSchema: {
				tagNames: ["iframe"],
				attributes: {
					iframe: ["src", "width", "height", "frameborder", "loading"],
				},
			},
		});
		const plugins = await embedRehypePlugins({ providers: [steamProvider] });
		const [, sanitize] = plugins;
		// rehype-sanitize は [plugin, schema] の形式
		expect(Array.isArray(sanitize)).toBe(true);
		const schema = (sanitize as [unknown, unknown])[1] as {
			tagNames?: string[];
		};
		expect(schema.tagNames).toContain("iframe");
	});

	it("スキーマに script が含まれない (strip されている)", async () => {
		const plugins = await embedRehypePlugins();
		const [, sanitize] = plugins;
		const schema = (sanitize as [unknown, unknown])[1] as { strip?: string[] };
		expect(schema.strip).toContain("script");
	});

	it("extendSchema で追加属性を許可できる", async () => {
		const plugins = await embedRehypePlugins({
			extendSchema: {
				attributes: { a: ["rel", "itemprop"] },
			},
		});
		const [, sanitize] = plugins;
		const schema = (sanitize as [unknown, unknown])[1] as {
			attributes?: Record<string, unknown>;
		};
		expect(schema.attributes?.a).toContain("itemprop");
	});

	it("providers が空でも正常に動作する", async () => {
		const plugins = await embedRehypePlugins({ providers: [] });
		expect(plugins).toHaveLength(2);
	});
});

describe("schema 深いマージ", () => {
	it("provider の protocols がマージされる", async () => {
		const provider = defineEmbedProvider({
			id: "p",
			match: () => true,
			render: () => ({ kind: "html", html: "" }),
			sanitizeSchema: {
				protocols: { src: ["data"] },
			},
		});
		const plugins = await embedRehypePlugins({ providers: [provider] });
		const [, sanitize] = plugins;
		const schema = (sanitize as [unknown, unknown])[1] as {
			protocols?: Record<string, string[]>;
		};
		expect(schema.protocols?.src).toContain("data");
		// base にあった https/http も残っている
		expect(schema.protocols?.src).toContain("https");
	});

	it("base に存在しない protocols 属性も追加できる", async () => {
		const provider = defineEmbedProvider({
			id: "p",
			match: () => true,
			render: () => ({ kind: "html", html: "" }),
			sanitizeSchema: {
				protocols: { poster: ["https"] },
			},
		});
		const plugins = await embedRehypePlugins({ providers: [provider] });
		const [, sanitize] = plugins;
		const schema = (sanitize as [unknown, unknown])[1] as {
			protocols?: Record<string, string[]>;
		};
		expect(schema.protocols?.poster).toContain("https");
	});

	it("provider の strip がマージされる", async () => {
		const provider = defineEmbedProvider({
			id: "p",
			match: () => true,
			render: () => ({ kind: "html", html: "" }),
			sanitizeSchema: { strip: ["custom-tag"] },
		});
		const plugins = await embedRehypePlugins({ providers: [provider] });
		const [, sanitize] = plugins;
		const schema = (sanitize as [unknown, unknown])[1] as { strip?: string[] };
		expect(schema.strip).toContain("custom-tag");
		expect(schema.strip).toContain("script");
	});

	it("base に存在しない attributes タグも追加できる", async () => {
		const provider = defineEmbedProvider({
			id: "p",
			match: () => true,
			render: () => ({ kind: "html", html: "" }),
			sanitizeSchema: {
				attributes: { article: ["data-id"] },
			},
		});
		const plugins = await embedRehypePlugins({ providers: [provider] });
		const [, sanitize] = plugins;
		const schema = (sanitize as [unknown, unknown])[1] as {
			attributes?: Record<string, unknown>;
		};
		expect(schema.attributes?.article).toContain("data-id");
	});
});

describe("notionEmbed 基本スキーマ", () => {
	it("nhc-bookmark に必要なタグを含む (a, div, p, img)", async () => {
		const plugins = await embedRehypePlugins();
		const [, sanitize] = plugins;
		const schema = (sanitize as [unknown, unknown])[1] as {
			tagNames?: string[];
		};
		expect(schema.tagNames).toContain("a");
		expect(schema.tagNames).toContain("div");
		expect(schema.tagNames).toContain("p");
		expect(schema.tagNames).toContain("img");
	});

	it("details / summary (toggle) が許可されている", async () => {
		const plugins = await embedRehypePlugins();
		const [, sanitize] = plugins;
		const schema = (sanitize as [unknown, unknown])[1] as {
			tagNames?: string[];
		};
		expect(schema.tagNames).toContain("details");
		expect(schema.tagNames).toContain("summary");
	});
});
