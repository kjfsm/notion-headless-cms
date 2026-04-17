import { describe, expect, it } from "vitest";
import { buildRssXml } from "./rss";

describe("buildRssXml", () => {
	it("escapes XML-sensitive characters in channel and item fields", () => {
		const xml = buildRssXml({
			title: "Euphoric & Band <News>",
			link: "https://example.com/?q=1&x=2",
			description: 'It\'s "awesome"',
			items: [
				{
					title: "A <B> & C",
					link: "https://example.com/blog/a?b=1&c=2",
					pubDate: "2025-01-01T00:00:00.000Z",
					description: "Rock 'n' Roll",
				},
			],
		});

		expect(xml).toContain("Euphoric &amp; Band &lt;News&gt;");
		expect(xml).toContain("https://example.com/?q=1&amp;x=2");
		expect(xml).toContain("It&apos;s &quot;awesome&quot;");
		expect(xml).toContain("A &lt;B&gt; &amp; C");
		expect(xml).toContain("Rock &apos;n&apos; Roll");
		expect(xml).toContain("Wed, 01 Jan 2025 00:00:00 GMT");
	});
});
