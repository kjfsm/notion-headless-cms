/** @vitest-environment happy-dom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NotionRenderer } from "../NotionRenderer.js";
import type { NotionBlock } from "../types.js";

const makeImage = (id: string, url: string): NotionBlock =>
  ({
    object: "block",
    id,
    type: "image",
    has_children: false,
    image: {
      type: "external",
      external: { url },
      caption: [],
    },
  }) as unknown as NotionBlock;

describe("Image srcSet (M5)", () => {
  afterEach(() => cleanup());

  it("imageSizes 指定 + resolveImageUrl で proxy 化されたとき srcSet を出す", () => {
    const block = makeImage("b1", "https://notion-signed.example/i.png");
    const { container } = render(
      <NotionRenderer
        blocks={[block]}
        resolveImageUrl={(url) => `/api/images/abc?orig=${encodeURIComponent(url)}`}
        imageSizes={[400, 800, 1200]}
        imageSizesAttr="(max-width: 768px) 100vw, 800px"
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    const srcSet = img?.getAttribute("srcset") ?? "";
    expect(srcSet).toContain("w=400");
    expect(srcSet).toContain("w=800");
    expect(srcSet).toContain("w=1200");
    expect(srcSet).toContain("400w");
    expect(img?.getAttribute("sizes")).toBe("(max-width: 768px) 100vw, 800px");
  });

  it("resolveImageUrl 未指定 (= proxy 化されない) なら srcSet を出さない", () => {
    const block = makeImage("b1", "https://notion-signed.example/i.png");
    const { container } = render(<NotionRenderer blocks={[block]} imageSizes={[400, 800]} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("srcset")).toBeNull();
  });

  it("imageSizes 空配列なら srcSet を出さない", () => {
    const block = makeImage("b1", "https://notion-signed.example/i.png");
    const { container } = render(
      <NotionRenderer
        blocks={[block]}
        resolveImageUrl={(url) => `/api/images/abc?orig=${url}`}
        imageSizes={[]}
      />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("srcset")).toBeNull();
  });
});
