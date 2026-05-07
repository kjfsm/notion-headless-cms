import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import { Equation as KatexEquation } from "../equation";
import { NotionRenderer } from "../NotionRenderer";
import type { BlockComponentProps, NotionBlock } from "../types";

const equation = (id: string, expr: string): NotionBlock =>
  ({
    object: "block",
    id,
    type: "equation",
    has_children: false,
    equation: { expression: expr },
  }) as unknown as NotionBlock;

const para = (id: string, text: string): NotionBlock =>
  ({
    object: "block",
    id,
    type: "paragraph",
    has_children: false,
    paragraph: {
      rich_text: [
        {
          type: "text",
          plain_text: text,
          href: null,
          text: { content: text, link: null },
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
      color: "default",
    },
  }) as unknown as NotionBlock;

const bullet = (id: string, text: string): NotionBlock =>
  ({
    object: "block",
    id,
    type: "bulleted_list_item",
    has_children: false,
    bulleted_list_item: {
      rich_text: [
        {
          type: "text",
          plain_text: text,
          href: null,
          text: { content: text, link: null },
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
      color: "default",
    },
  }) as unknown as NotionBlock;

describe("NotionRenderer", () => {
  it("paragraph を描画する", () => {
    const { container } = render(
      <NotionRenderer blocks={[para("p1", "hello")]} />,
    );
    expect(container.textContent).toContain("hello");
  });

  it("連続する bulleted_list_item を 1 つの ul にまとめる", () => {
    const { container } = render(
      <NotionRenderer blocks={[bullet("a", "one"), bullet("b", "two")]} />,
    );
    const uls = container.querySelectorAll("ul");
    expect(uls).toHaveLength(1);
    expect(uls[0]?.querySelectorAll("li")).toHaveLength(2);
  });

  it("段落を間に挟むと ul は分割される", () => {
    const { container } = render(
      <NotionRenderer
        blocks={[bullet("a", "one"), para("p", "x"), bullet("b", "two")]}
      />,
    );
    expect(container.querySelectorAll("ul")).toHaveLength(2);
  });

  it("未対応 block type は Unsupported に落ちる", () => {
    const unsupported = {
      object: "block",
      id: "u1",
      type: "unknown_future_block",
      has_children: false,
    } as unknown as NotionBlock;
    const { container } = render(<NotionRenderer blocks={[unsupported]} />);
    expect(container.textContent).toContain("Unsupported");
  });

  // 既定の Equation は katex を含まないスタブ実装。
  // bundle に katex が混入しないことの担保として、katex の出力（`katex` クラス
  // を持つ span 要素）が描画されないことを確認する。
  it("デフォルトの Equation は katex を呼ばずに生の式を出す", () => {
    const { container } = render(
      <NotionRenderer blocks={[equation("e1", "E = mc^2")]} />,
    );
    expect(container.textContent).toContain("E = mc^2");
    expect(container.querySelector(".katex")).toBeNull();
  });

  // `./equation` サブパスから差し込めば katex 出力に切り替わることを確認する。
  // `ComponentOverrides.Equation` は broad な BlockObjectResponse 型を受けるため、
  // 個別 block 型に narrowing された KatexEquation はそのままでは渡せない。
  // 内部 dispatch (BlockSwitch) で narrow 化されるため、利用側でも同じキャストが必要になる。
  // 個別 block 型を受ける override の DX 改善は別 issue にて。
  it("components.Equation に ./equation の実装を差し込むと katex が動く", () => {
    const { container } = render(
      <NotionRenderer
        blocks={[equation("e1", "E = mc^2")]}
        components={{
          Equation:
            KatexEquation as unknown as ComponentType<BlockComponentProps>,
        }}
      />,
    );
    expect(container.querySelector(".katex")).not.toBeNull();
  });
});
