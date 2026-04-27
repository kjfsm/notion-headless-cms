import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOgpCache } from "../../ogp";
import {
	escapeAttr,
	escapeHtml,
	renderIframe,
} from "../../providers/_internal";
import { dlsiteProvider } from "../../providers/dlsite";
import { genericIframeProvider } from "../../providers/generic-iframe";
import { defineEmbedProvider, matchProvider } from "../../providers/index";
import { steamProvider } from "../../providers/steam";
import { twitterProvider } from "../../providers/twitter";
import { vimeoProvider } from "../../providers/vimeo";
import { youtubeProvider } from "../../providers/youtube";
import type { BlockObjectResponse } from "../../types";

const dummyBlock = {} as unknown as BlockObjectResponse;

describe("_internal helpers", () => {
	describe("escapeAttr / escapeHtml", () => {
		it("& < > \" ' をエスケープする", () => {
			expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
			expect(escapeAttr(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
		});

		it("通常文字はそのまま", async () => {
			expect(escapeHtml("hello world")).toBe("hello world");
		});
	});

	describe("renderIframe", () => {
		it("最低限 src と loading=lazy を出す", async () => {
			const html = renderIframe({ src: "https://example.com" });
			expect(html).toContain('src="https://example.com"');
			expect(html).toContain('loading="lazy"');
		});

		it("width/height/frameborder/allow/allowFullscreen を含む", async () => {
			const html = renderIframe({
				src: "https://x",
				width: 640,
				height: 360,
				frameborder: 0,
				allow: "autoplay",
				allowFullscreen: true,
			});
			expect(html).toContain('width="640"');
			expect(html).toContain('height="360"');
			expect(html).toContain('frameborder="0"');
			expect(html).toContain('allow="autoplay"');
			expect(html).toContain("allowfullscreen");
		});

		it("数値以外の width/height は出さない", async () => {
			const html = renderIframe({ src: "https://x" });
			expect(html).not.toContain("width=");
			expect(html).not.toContain("height=");
		});
	});
});

describe("defineEmbedProvider / matchProvider", () => {
	const a = defineEmbedProvider({
		id: "a",
		match: (u) => u.startsWith("https://a.example/"),
		render: () => ({ kind: "html", html: "<a/>" }),
	});
	const b = defineEmbedProvider({
		id: "b",
		match: (u) => u.startsWith("https://b.example/"),
		render: () => ({ kind: "html", html: "<b/>" }),
	});

	it("最初にマッチした provider を返す", async () => {
		expect(matchProvider([a, b], "https://a.example/x")?.id).toBe("a");
		expect(matchProvider([a, b], "https://b.example/x")?.id).toBe("b");
	});

	it("どれもマッチしなければ undefined", async () => {
		expect(matchProvider([a, b], "https://other.example/")).toBeUndefined();
	});

	it("provider 配列が空でも undefined", async () => {
		expect(matchProvider([], "https://x")).toBeUndefined();
	});
});

describe("steamProvider", () => {
	const provider = steamProvider();

	it("widget URL にマッチする", async () => {
		expect(
			provider.match("https://store.steampowered.com/widget/2516990/"),
		).toBe(true);
	});

	it("非 Steam URL にマッチしない", async () => {
		expect(provider.match("https://example.com")).toBe(false);
	});

	it("iframe を返す (デフォルト 646x190)", async () => {
		const out = await provider.render({
			block: dummyBlock,
			url: "https://store.steampowered.com/widget/2516990/",
		});
		expect(out.kind).toBe("html");
		if (out.kind === "html") {
			expect(out.html).toContain("<iframe");
			expect(out.html).toContain('width="646"');
			expect(out.html).toContain('height="190"');
		}
	});

	it("オプションで width/height を上書きできる", async () => {
		const p = steamProvider({ width: 800, height: 200 });
		const out = await p.render({
			block: dummyBlock,
			url: "https://store.steampowered.com/widget/1/",
		});
		if (out.kind === "html") {
			expect(out.html).toContain('width="800"');
			expect(out.html).toContain('height="200"');
		}
	});

	it("ctx の width/height がさらに上書きする", async () => {
		const out = await provider.render({
			block: dummyBlock,
			url: "https://store.steampowered.com/widget/1/",
			width: 999,
			height: 333,
		});
		if (out.kind === "html") {
			expect(out.html).toContain('width="999"');
			expect(out.html).toContain('height="333"');
		}
	});
});

describe("youtubeProvider", () => {
	const provider = youtubeProvider();

	beforeEach(() => clearOgpCache());
	afterEach(() => clearOgpCache());

	it("youtube.com/watch?v=... にマッチ", async () => {
		expect(provider.match("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
			true,
		);
	});

	it("youtu.be/<id> にマッチ", async () => {
		expect(provider.match("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
	});

	it("非 YouTube は false", async () => {
		expect(provider.match("https://example.com")).toBe(false);
	});

	it("iframe URL は youtube.com/embed/{id}", async () => {
		const out = await provider.render({
			block: dummyBlock,
			url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		});
		if (out.kind === "html") {
			expect(out.html).toContain("youtube.com/embed/dQw4w9WgXcQ");
			expect(out.html).toContain("allowfullscreen");
		}
	});

	it("動画 ID が抽出できないチャンネル URL は card にフォールバックする", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({}), {
				headers: { "content-type": "application/json" },
			}),
		);
		try {
			const out = await provider.render({
				block: dummyBlock,
				url: "https://www.youtube.com/@some-channel",
			});
			expect(out.kind).toBe("html");
			if (out.kind === "html") {
				expect(out.html).toContain("nhc-bookmark--youtube");
			}
		} finally {
			fetchSpy.mockRestore();
		}
	});

	describe("display: card", () => {
		const cardProvider = youtubeProvider({ display: "card" });

		it("YouTube ホストにマッチする (チャンネル URL も含む)", () => {
			expect(cardProvider.match("https://www.youtube.com/@Euphoric-Band")).toBe(
				true,
			);
			expect(
				cardProvider.match("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
			).toBe(true);
			expect(cardProvider.match("https://example.com")).toBe(false);
		});

		it("oEmbed を取得して bookmark 風カード HTML を返す", async () => {
			const oembedJson = JSON.stringify({
				title: "Euphoric Band",
				thumbnail_url: "https://example.com/cover.jpg",
				author_name: "Euphoric Band Channel",
			});
			const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
				new Response(oembedJson, {
					headers: { "content-type": "application/json" },
				}),
			);
			try {
				const out = await cardProvider.render({
					block: dummyBlock,
					url: "https://www.youtube.com/@Euphoric-Band",
				});
				expect(out.kind).toBe("html");
				if (out.kind === "html") {
					expect(out.html).toContain("nhc-bookmark nhc-bookmark--youtube");
					expect(out.html).toContain(
						'href="https://www.youtube.com/@Euphoric-Band"',
					);
					expect(out.html).toContain("Euphoric Band");
					expect(out.html).toContain("https://example.com/cover.jpg");
					expect(out.html).toContain("Euphoric Band Channel");
				}
			} finally {
				fetchSpy.mockRestore();
			}
		});

		it("oEmbed 失敗時にホスト名をタイトルとして使い nhc-bookmark--no-ogp を付ける", async () => {
			const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
				new Response(JSON.stringify({}), {
					headers: { "content-type": "application/json" },
				}),
			);
			try {
				const out = await cardProvider.render({
					block: dummyBlock,
					url: "https://www.youtube.com/@some-channel",
				});
				expect(out.kind).toBe("html");
				if (out.kind === "html") {
					expect(out.html).toContain("nhc-bookmark--no-ogp");
					expect(out.html).toContain("www.youtube.com");
				}
			} finally {
				fetchSpy.mockRestore();
			}
		});

		it("ogp: false では oEmbed fetch を行わず nhc-bookmark--no-ogp を付ける", async () => {
			const fetchSpy = vi
				.spyOn(globalThis, "fetch")
				.mockResolvedValue(new Response(JSON.stringify({})));
			const noOgp = youtubeProvider({ display: "card", ogp: false });
			const out = await noOgp.render({
				block: dummyBlock,
				url: "https://www.youtube.com/@some-channel",
			});
			expect(fetchSpy).not.toHaveBeenCalled();
			expect(out.kind).toBe("html");
			if (out.kind === "html") {
				expect(out.html).toContain("nhc-bookmark--youtube");
				expect(out.html).toContain("nhc-bookmark--no-ogp");
			}
			fetchSpy.mockRestore();
		});
	});
});

describe("vimeoProvider", () => {
	const provider = vimeoProvider();

	it("vimeo.com/<id> にマッチ", async () => {
		expect(provider.match("https://vimeo.com/123456")).toBe(true);
	});

	it("非 Vimeo URL にマッチしない", async () => {
		expect(provider.match("https://example.com")).toBe(false);
	});

	it("oEmbed から embed src を取得して iframe を返す", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					html: '<iframe src="https://player.vimeo.com/video/123456?h=abc"></iframe>',
				}),
				{ headers: { "content-type": "application/json" } },
			),
		);
		try {
			const out = await provider.render({
				block: dummyBlock,
				url: "https://vimeo.com/123456",
			});
			if (out.kind === "html") {
				expect(out.html).toContain("player.vimeo.com/video/123456");
				expect(out.html).toContain("<iframe");
			}
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it("ctx の width/height で上書きできる", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					html: '<iframe src="https://player.vimeo.com/video/1"></iframe>',
				}),
				{ headers: { "content-type": "application/json" } },
			),
		);
		try {
			const out = await provider.render({
				block: dummyBlock,
				url: "https://vimeo.com/1",
				width: 100,
				height: 50,
			});
			if (out.kind === "html") {
				expect(out.html).toContain('width="100"');
				expect(out.html).toContain('height="50"');
			}
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it("oEmbed が html を返さなければ skip", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({}), {
				headers: { "content-type": "application/json" },
			}),
		);
		try {
			const out = await provider.render({
				block: dummyBlock,
				url: "https://vimeo.com/",
			});
			expect(out.kind).toBe("skip");
		} finally {
			fetchSpy.mockRestore();
		}
	});
});

describe("twitterProvider", () => {
	const provider = twitterProvider();

	it("x.com/.../status/... にマッチ", async () => {
		expect(provider.match("https://x.com/foo/status/12345")).toBe(true);
	});

	it("twitter.com/.../status/... にマッチ", async () => {
		expect(provider.match("https://twitter.com/foo/status/12345")).toBe(true);
	});

	it("twitter.com を x.com に正規化する", async () => {
		const out = await provider.render({
			block: dummyBlock,
			url: "https://twitter.com/foo/status/12345",
		});
		if (out.kind === "html") {
			expect(out.html).toContain("x.com/foo/status/12345");
			expect(out.html).toContain("twitter-tweet");
			expect(out.html).toContain("platform.x.com/widgets.js");
		}
	});
});

describe("dlsiteProvider", () => {
	const provider = dlsiteProvider();

	it("dlaf.jp にマッチ", async () => {
		expect(provider.match("https://dlaf.jp/sample")).toBe(true);
	});

	it("img.dlsite.jp にマッチ", async () => {
		expect(provider.match("https://img.dlsite.jp/foo.jpg")).toBe(true);
	});

	it("非 DLsite は false", async () => {
		expect(provider.match("https://example.com")).toBe(false);
	});

	it('dlaf.jp は rel="noopener sponsored" を付ける', async () => {
		const out = await provider.render({
			block: dummyBlock,
			url: "https://dlaf.jp/x",
		});
		if (out.kind === "html") {
			expect(out.html).toContain('rel="noopener sponsored"');
		}
	});

	it('img.dlsite.jp は rel="noopener noreferrer"', async () => {
		const out = await provider.render({
			block: dummyBlock,
			url: "https://img.dlsite.jp/foo.jpg",
		});
		if (out.kind === "html") {
			expect(out.html).toContain('rel="noopener noreferrer"');
		}
	});

	it("URL が壊れていたら normalizeUrl で復元する", async () => {
		const out = await provider.render({
			block: dummyBlock,
			url: "[//img.dlsite.jp/x.jpg](https://img.dlsite.jp/x.jpg)",
		});
		if (out.kind === "html") {
			expect(out.html).toContain('href="https://img.dlsite.jp/x.jpg"');
		}
	});
});

describe("genericIframeProvider", () => {
	const provider = genericIframeProvider({
		allowedHosts: ["allowed.example", "trusted.com"],
		width: 500,
		height: 300,
	});

	it("許可ホストの URL にマッチ", async () => {
		expect(provider.match("https://allowed.example/path")).toBe(true);
	});

	it("サブドメインも許可される", async () => {
		expect(provider.match("https://sub.allowed.example/")).toBe(true);
	});

	it("非許可ホストにはマッチしない", async () => {
		expect(provider.match("https://blocked.example")).toBe(false);
	});

	it("無効な URL は false", async () => {
		expect(provider.match("not a url")).toBe(false);
	});

	it("iframe を返す", async () => {
		const out = await provider.render({
			block: dummyBlock,
			url: "https://allowed.example/x",
		});
		if (out.kind === "html") {
			expect(out.html).toContain("<iframe");
			expect(out.html).toContain('width="500"');
			expect(out.html).toContain('height="300"');
		}
	});

	it("空の allowedHosts では何もマッチしない", async () => {
		const empty = genericIframeProvider({ allowedHosts: [] });
		expect(empty.match("https://anything.example")).toBe(false);
	});
});
