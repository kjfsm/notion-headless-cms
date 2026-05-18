import { describe, expect, it } from "vitest";
import { blocksFetcher } from "../index";

describe("blocksFetcher", () => {
  it("kind は 'blocks' で loadNotionBlocks を実装する", () => {
    const f = blocksFetcher();
    expect(f.kind).toBe("blocks");
    expect(typeof f.loadNotionBlocks).toBe("function");
    expect(typeof f.loadMarkdown).toBe("function");
  });

  it("オプションを保持し factory として複数回呼び出せる", () => {
    const a = blocksFetcher({ concurrency: 5 });
    const b = blocksFetcher({ concurrency: 1 });
    expect(a).not.toBe(b);
    expect(a.kind).toBe("blocks");
    expect(b.kind).toBe("blocks");
  });
});
