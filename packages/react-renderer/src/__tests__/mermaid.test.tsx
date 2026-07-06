import type { CodeBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MermaidCode } from "../mermaid.js";

const initialize = vi.fn();
const renderFn = vi.fn(async (_id: string, _source: string) => ({
  svg: "<svg><g></g></svg>",
}));

vi.mock("mermaid", () => ({
  default: {
    initialize,
    render: renderFn,
  },
}));

function codeBlock(language: string, source: string): CodeBlockObjectResponse {
  return {
    object: "block",
    id: "c1",
    type: "code",
    has_children: false,
    code: {
      language,
      caption: [],
      rich_text: [
        {
          type: "text",
          plain_text: source,
          href: null,
          text: { content: source, link: null },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
        },
      ],
    },
  } as unknown as CodeBlockObjectResponse;
}

describe("MermaidCode", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("mermaid を securityLevel: 'strict' で初期化する(格納型 XSS を防ぐ)", async () => {
    render(<MermaidCode block={codeBlock("mermaid", "graph TD; A-->B")} />);

    await waitFor(() => {
      expect(initialize).toHaveBeenCalled();
    });
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: "strict" }));
    // "loose" では初期化しないこと。
    expect(initialize).not.toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "loose" }),
    );
  });
});
