"use client";

import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import { Fragment } from "react";
import { useNotionContext } from "../context.js";
import { Annotated } from "./Annotation";
import { InlineEquation as DefaultInlineEquation } from "./InlineEquation";
import { Mention } from "./Mention";

export interface RichTextProps {
  value: ReadonlyArray<RichTextItemResponse>;
}

/** rich_text 配列を React のインライン要素として描画する。 */
export function RichText({ value }: RichTextProps) {
  return (
    <>
      {value.map((item, idx) => (
        // rich_text 配列の要素は同じ key 戦略で十分 (描画時に組み替えが起きないため)
        // biome-ignore lint/suspicious/noArrayIndexKey: rich_text の並びは安定している
        <RichTextItem key={idx} item={item} />
      ))}
    </>
  );
}

function RichTextItem({ item }: { item: RichTextItemResponse }) {
  const { components } = useNotionContext();

  if (item.type === "mention") {
    return (
      <Annotated annotations={item.annotations} href={item.href}>
        <Mention item={item} />
      </Annotated>
    );
  }

  if (item.type === "equation") {
    // override が無ければ既定の lazy KaTeX を使う。
    const InlineEquation = components.InlineEquation ?? DefaultInlineEquation;
    return (
      <Annotated annotations={item.annotations} href={item.href}>
        <InlineEquation expression={item.equation.expression} />
      </Annotated>
    );
  }

  // text
  const url = item.text.link?.url ?? item.href ?? null;
  return (
    <Annotated annotations={item.annotations} href={url}>
      {renderWithLineBreaks(item.text.content)}
    </Annotated>
  );
}

/** テキスト内の改行文字を <br> 要素に変換する。 */
function renderWithLineBreaks(content: string) {
  const parts = content.split("\n");
  if (parts.length === 1) return content;
  return parts.map((part, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: 改行分割の順序は安定している
    <Fragment key={i}>
      {i > 0 && <br />}
      {part}
    </Fragment>
  ));
}
