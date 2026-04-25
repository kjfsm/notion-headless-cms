import { describe, expect, it, vi } from "vitest";
import { definePlugin } from "../types/plugin";

describe("definePlugin", () => {
	it("渡したプラグインオブジェクトをそのまま返す", () => {
		const plugin = definePlugin({
			name: "test-plugin",
		});
		expect(plugin.name).toBe("test-plugin");
	});

	it("hooks を持つプラグインを定義できる", () => {
		const onRenderStart = vi.fn();
		const plugin = definePlugin({
			name: "hooks-plugin",
			hooks: { onRenderStart },
		});
		expect(plugin.hooks?.onRenderStart).toBe(onRenderStart);
	});

	it("logger を持つプラグインを定義できる", () => {
		const info = vi.fn();
		const plugin = definePlugin({
			name: "logger-plugin",
			logger: { info },
		});
		expect(plugin.logger?.info).toBe(info);
	});
});
