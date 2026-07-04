import { describe, expect, it, vi } from "vitest";
import { createLeveledLogger } from "../logger.js";
import type { Logger } from "../types/logger.js";

function makeSpyLogger(): Required<Logger> {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("createLeveledLogger", () => {
  it("logger 未指定なら全レベル no-op（呼んでも throw しない）", () => {
    const log = createLeveledLogger(undefined, undefined);
    expect(() => log.debug("x")).not.toThrow();
    expect(() => log.error("y", { operation: "z" })).not.toThrow();
  });

  it("logLevel 未指定なら全レベルをそのまま透過する", () => {
    const inner = makeSpyLogger();
    const log = createLeveledLogger(inner, undefined);
    log.debug("d", { operation: "op" });
    log.error("e");
    expect(inner.debug).toHaveBeenCalledWith("d", { operation: "op" });
    expect(inner.error).toHaveBeenCalledWith("e", undefined);
  });

  it("logLevel 未満のレベルは抑制する", () => {
    const inner = makeSpyLogger();
    const log = createLeveledLogger(inner, "warn");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(inner.debug).not.toHaveBeenCalled();
    expect(inner.info).not.toHaveBeenCalled();
    expect(inner.warn).toHaveBeenCalledWith("w", undefined);
    expect(inner.error).toHaveBeenCalledWith("e", undefined);
  });

  it("inner が一部メソッドのみ実装でも安全に呼べる", () => {
    const warn = vi.fn();
    const log = createLeveledLogger({ warn }, undefined);
    expect(() => log.debug("d")).not.toThrow();
    log.warn("w");
    expect(warn).toHaveBeenCalledWith("w", undefined);
  });
});
