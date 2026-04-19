import { describe, expect, it } from "vitest";
import { isStale, sha256Hex } from "../cache";

describe("sha256Hex", () => {
	it("空文字列のSHA-256ハッシュを返す", async () => {
		const result = await sha256Hex("");
		expect(result).toBe(
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		);
	});

	it("文字列のSHA-256ハッシュを返す", async () => {
		const result = await sha256Hex("hello");
		expect(result).toBe(
			"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
		);
	});

	it("同じ入力から同じハッシュを生成する", async () => {
		const a = await sha256Hex("test-url");
		const b = await sha256Hex("test-url");
		expect(a).toBe(b);
	});

	it("異なる入力から異なるハッシュを生成する", async () => {
		const a = await sha256Hex("url-1");
		const b = await sha256Hex("url-2");
		expect(a).not.toBe(b);
	});
});

describe("isStale", () => {
	it("ttlMs が未定義の場合は常に false を返す", () => {
		expect(isStale(0)).toBe(false);
		expect(isStale(Date.now() - 1_000_000)).toBe(false);
	});

	it("TTL 以内なら false を返す", () => {
		expect(isStale(Date.now() - 1_000, 5_000)).toBe(false);
	});

	it("TTL 超過なら true を返す", () => {
		expect(isStale(Date.now() - 10_000, 5_000)).toBe(true);
	});

	it("ちょうど TTL の境界値は true を返す", () => {
		expect(isStale(Date.now() - 5_001, 5_000)).toBe(true);
	});
});
