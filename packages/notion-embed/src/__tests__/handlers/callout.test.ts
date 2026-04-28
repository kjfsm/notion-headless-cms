import type { CalloutBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import { renderCallout } from "../../handlers/callout";

const blockBase = {
	object: "block" as const,
	id: "id",
	parent: { type: "page_id" as const, page_id: "p" },
	created_time: "",
	last_edited_time: "",
	created_by: { object: "user" as const, id: "u" },
	last_edited_by: { object: "user" as const, id: "u" },
	has_children: false,
	archived: false,
	in_trash: false,
};

const text = (s: string) => ({
	type: "text" as const,
	text: { content: s, link: null },
	annotations: {
		bold: false,
		italic: false,
		strikethrough: false,
		underline: false,
		code: false,
		color: "default" as const,
	},
	plain_text: s,
	href: null,
});

describe("renderCallout", () => {
	it("emoji アイコン付きで callout を出す", async () => {
		const block: CalloutBlockObjectResponse = {
			...blockBase,
			type: "callout",
			callout: {
				rich_text: [text("ヒント")],
				color: "default",
				icon: { type: "emoji", emoji: "💡" },
			},
		};
		const html = await renderCallout(block);
		expect(html).toContain('class="nhc-callout"');
		expect(html).toContain("💡");
		expect(html).toContain("ヒント");
	});

	it("デフォルト以外の色は nhc-callout--<color> を付ける", async () => {
		const block: CalloutBlockObjectResponse = {
			...blockBase,
			type: "callout",
			callout: {
				rich_text: [text("注意")],
				color: "yellow_background",
				icon: { type: "emoji", emoji: "⚠️" },
			},
		};
		const html = await renderCallout(block);
		expect(html).toContain("nhc-callout--yellow_background");
	});

	it("外部画像アイコンに対応する", async () => {
		const block = {
			...blockBase,
			type: "callout",
			callout: {
				rich_text: [text("外部")],
				color: "default",
				icon: {
					type: "external",
					external: { url: "https://example.com/icon.png" },
				},
			},
		} as CalloutBlockObjectResponse;
		const html = await renderCallout(block);
		expect(html).toContain('<img class="nhc-callout__icon"');
		expect(html).toContain("https://example.com/icon.png");
	});

	it("file アイコンに対応する", async () => {
		const block = {
			...blockBase,
			type: "callout",
			callout: {
				rich_text: [text("file")],
				color: "default",
				icon: { type: "file", file: { url: "https://files.notion.so/x.png" } },
			},
		} as CalloutBlockObjectResponse;
		const html = await renderCallout(block);
		expect(html).toContain("https://files.notion.so/x.png");
	});

	it("file アイコンで url が無ければ何も出さない", async () => {
		const block = {
			...blockBase,
			type: "callout",
			callout: {
				rich_text: [text("nofile")],
				color: "default",
				icon: { type: "file", file: { url: "" } },
			},
		} as CalloutBlockObjectResponse;
		const html = await renderCallout(block);
		expect(html).toContain("nofile");
		expect(html).not.toContain("<img");
	});

	it("アイコンなしでも動く", async () => {
		const block = {
			...blockBase,
			type: "callout",
			callout: { rich_text: [text("noicon")], color: "default", icon: null },
		} as CalloutBlockObjectResponse;
		const html = await renderCallout(block);
		expect(html).toContain("noicon");
		expect(html).not.toContain("nhc-callout__icon");
	});
});
