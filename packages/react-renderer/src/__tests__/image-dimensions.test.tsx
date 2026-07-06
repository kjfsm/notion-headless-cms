/** @vitest-environment happy-dom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NotionRenderer } from "../NotionRenderer.js";
import type { NotionBlock } from "../types.js";

const makeImage = (
  id: string,
  url: string,
  dimensions?: { width: number; height: number },
): NotionBlock =>
  ({
    object: "block",
    id,
    type: "image",
    has_children: false,
    image: {
      type: "external",
      external: { url },
      caption: [],
      ...(dimensions ? { _dimensions: dimensions } : {}),
    },
  }) as unknown as NotionBlock;

describe("Image CLS 対応(cms 同期パイプラインが焼き込む _dimensions)", () => {
  afterEach(() => cleanup());

  it("_dimensions があれば width/height 属性を付与する(CLS ゼロ化)", () => {
    const block = makeImage("b1", "https://example.com/a.png", {
      width: 640,
      height: 480,
    });
    const { container } = render(<NotionRenderer blocks={[block]} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("width")).toBe("640");
    expect(img?.getAttribute("height")).toBe("480");
    expect(img?.getAttribute("loading")).toBe("lazy");
  });

  it("_dimensions が無ければ width/height 属性を付与しない(通常データ互換)", () => {
    const block = makeImage("b1", "https://example.com/a.png");
    const { container } = render(<NotionRenderer blocks={[block]} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("width")).toBeNull();
    expect(img?.getAttribute("height")).toBeNull();
  });
});
