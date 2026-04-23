import { describe, expect, it } from "vitest";
import { CMSError, isCMSError, isCMSErrorInNamespace } from "../errors";

describe("CMSError", () => {
	const baseParams = {
		code: "core/config_invalid" as const,
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
		expect(err.code).toBe("core/config_invalid");
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

	it("組み込みエラーコードで生成できる", () => {
		const codes = [
			"core/config_invalid",
			"core/schema_invalid",
			"core/notion_orm_missing",
			"source/fetch_items_failed",
			"source/fetch_item_failed",
			"source/load_markdown_failed",
			"cache/io_failed",
			"renderer/failed",
			"cli/config_invalid",
			"cli/config_load_failed",
			"cli/schema_invalid",
			"cli/generate_failed",
			"cli/init_failed",
			"cli/notion_api_failed",
			"cli/env_file_not_found",
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

	it("cli/* 名前空間で判定できる", () => {
		const err = new CMSError({
			code: "cli/config_invalid",
			message: "test",
			context: { operation: "loadConfig" },
		});
		expect(isCMSErrorInNamespace(err, "cli/")).toBe(true);
		expect(isCMSErrorInNamespace(err, "core/")).toBe(false);
	});

	it("サードパーティのカスタムコードでも生成できる", () => {
		const err = new CMSError({
			code: "my-adapter/custom_error",
			message: "カスタムエラー",
			context: { operation: "test" },
		});
		expect(err.code).toBe("my-adapter/custom_error");
	});
});

describe("isCMSError", () => {
	it("CMSError なら true を返す", () => {
		const err = new CMSError({
			code: "core/config_invalid",
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

describe("isCMSErrorInNamespace", () => {
	it("名前空間が一致するなら true を返す", () => {
		const err = new CMSError({
			code: "source/fetch_items_failed",
			message: "test",
			context: { operation: "test" },
		});
		expect(isCMSErrorInNamespace(err, "source/")).toBe(true);
	});

	it("名前空間が一致しないなら false を返す", () => {
		const err = new CMSError({
			code: "source/fetch_items_failed",
			message: "test",
			context: { operation: "test" },
		});
		expect(isCMSErrorInNamespace(err, "cache/")).toBe(false);
	});

	it("CMSError でない場合は false を返す", () => {
		expect(isCMSErrorInNamespace(new Error("test"), "source/")).toBe(false);
	});
});
