import { describe, expect, it } from "vitest";
import { CMSError, isCMSError } from "../errors";

describe("CMSError", () => {
	const baseParams = {
		code: "CONFIG_INVALID" as const,
		message: "設定が無効です",
		context: { operation: "init" },
	};

	it("name が CMSError になる", () => {
		const err = new CMSError(baseParams);
		expect(err.name).toBe("CMSError");
	});

	it("message が設定される", () => {
		const err = new CMSError(baseParams);
		expect(err.message).toBe("設定が無効です");
	});

	it("code が設定される", () => {
		const err = new CMSError(baseParams);
		expect(err.code).toBe("CONFIG_INVALID");
	});

	it("context が設定される", () => {
		const err = new CMSError(baseParams);
		expect(err.context).toEqual({ operation: "init" });
	});

	it("cause を省略した場合は undefined になる", () => {
		const err = new CMSError(baseParams);
		expect(err.cause).toBeUndefined();
	});

	it("cause を指定した場合は設定される", () => {
		const cause = new Error("原因エラー");
		const err = new CMSError({ ...baseParams, cause });
		expect(err.cause).toBe(cause);
	});

	it("Error のサブクラスである", () => {
		const err = new CMSError(baseParams);
		expect(err).toBeInstanceOf(Error);
	});

	it("各エラーコードで生成できる", () => {
		const codes = [
			"CONFIG_INVALID",
			"NOTION_ITEM_SCHEMA_INVALID",
			"NOTION_FETCH_ITEMS_FAILED",
			"NOTION_FETCH_ITEM_BY_SLUG_FAILED",
			"NOTION_GET_BLOCKS_FAILED",
			"NOTION_MARKDOWN_FETCH_FAILED",
			"IMAGE_CACHE_FAILED",
			"RENDERER_FAILED",
		] as const;
		for (const code of codes) {
			const err = new CMSError({
				code,
				message: "test",
				context: { operation: "test" },
			});
			expect(err.code).toBe(code);
		}
	});
});

describe("isCMSError", () => {
	it("CMSError なら true を返す", () => {
		const err = new CMSError({
			code: "CONFIG_INVALID",
			message: "test",
			context: { operation: "test" },
		});
		expect(isCMSError(err)).toBe(true);
	});

	it("通常の Error なら false を返す", () => {
		expect(isCMSError(new Error("test"))).toBe(false);
	});

	it("null なら false を返す", () => {
		expect(isCMSError(null)).toBe(false);
	});

	it("文字列なら false を返す", () => {
		expect(isCMSError("error")).toBe(false);
	});

	it("undefined なら false を返す", () => {
		expect(isCMSError(undefined)).toBe(false);
	});
});
