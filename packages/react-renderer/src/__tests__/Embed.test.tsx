import type { EmbedBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Embed } from "../blocks/Embed.js";
import { NotionContext } from "../context.js";

function embedBlock(url: string): EmbedBlockObjectResponse {
  return {
    object: "block",
    id: "e1",
    type: "embed",
    has_children: false,
    embed: { url, caption: [] },
  } as unknown as EmbedBlockObjectResponse;
}

function renderEmbed(url: string) {
  return render(
    <NotionContext.Provider value={{ components: {} }}>
      <Embed block={embedBlock(url)} />
    </NotionContext.Provider>,
  );
}

describe("Embed", () => {
  it("正常な http(s) URL は iframe として描画する", () => {
    const { container } = renderEmbed("https://example.com/widget");
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toBe("https://example.com/widget");
  });

  it("javascript: URL は iframe を描画せずリンクにフォールバックする", () => {
    const { container } = renderEmbed("javascript:alert(1)");
    expect(container.querySelector("iframe")).toBeNull();
    // 危険な href は付与されない(安全なアンカーにならない)。
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href") ?? null).toBeNull();
  });

  it("data:text/html URL も iframe を描画しない", () => {
    const { container } = renderEmbed("data:text/html,<script>alert(1)</script>");
    expect(container.querySelector("iframe")).toBeNull();
  });
});
