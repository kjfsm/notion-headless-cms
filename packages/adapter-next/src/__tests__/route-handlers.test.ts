import { describe, expect, it, vi } from "vitest";
import { createNextHandler } from "../route-handlers";

const makeMockCMS = () => ({
  handler: vi.fn().mockReturnValue(async () => new Response("ok")),
});

describe("createNextHandler", () => {
  it("cms.handler() を呼び出してハンドラ関数を返す", () => {
    const cms = makeMockCMS();
    const handler = createNextHandler(cms as never, {
      webhookSecret: "secret",
    });
    expect(typeof handler).toBe("function");
    expect(cms.handler).toHaveBeenCalledWith({ webhookSecret: "secret" });
  });

  it("opts 省略時は webhookSecret なしで cms.handler() を呼ぶ", () => {
    const cms = makeMockCMS();
    createNextHandler(cms as never);
    expect(cms.handler).toHaveBeenCalledWith({ webhookSecret: undefined });
  });
});
