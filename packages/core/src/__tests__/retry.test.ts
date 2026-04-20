import { describe, expect, it, vi } from "vitest";
import type { RetryConfig } from "../retry";
import { withRetry } from "../retry";

const config: RetryConfig = {
	maxConcurrent: 1,
	retryOn: [429, 503],
	maxRetries: 3,
	baseDelayMs: 1,
};

describe("withRetry", () => {
	it("初回成功の場合はリトライしない", async () => {
		const fn = vi.fn().mockResolvedValue("ok");
		const result = await withRetry(fn, config);
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("429 エラーでリトライする", async () => {
		const err = Object.assign(new Error("rate limit"), { status: 429 });
		const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
		const result = await withRetry(fn, config);
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("maxRetries 超過でエラーをスロー", async () => {
		const err = Object.assign(new Error("rate limit"), { status: 429 });
		const fn = vi.fn().mockRejectedValue(err);
		await expect(withRetry(fn, config)).rejects.toThrow("rate limit");
		expect(fn).toHaveBeenCalledTimes(config.maxRetries + 1);
	});

	it("retryOn 対象外のステータスは即スロー", async () => {
		const err = Object.assign(new Error("not found"), { status: 404 });
		const fn = vi.fn().mockRejectedValue(err);
		await expect(withRetry(fn, config)).rejects.toThrow("not found");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("onRetry コールバックが呼ばれる", async () => {
		const onRetry = vi.fn();
		const err = Object.assign(new Error("rate limit"), { status: 429 });
		const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
		await withRetry(fn, { ...config, onRetry });
		expect(onRetry).toHaveBeenCalledWith(1, 429);
	});
});
