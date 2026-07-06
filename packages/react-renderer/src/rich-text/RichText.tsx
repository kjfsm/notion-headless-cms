"use client";

import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import { Fragment } from "react";

import { useNotionContext } from "../context.js";
import type { EquationRichTextWithCachedHtml } from "../internal/notion-extensions.js";
import { Annotated } from "./Annotation";
import { InlineEquation as DefaultInlineEquation } from "./InlineEquation";
import { Mention } from "./Mention";

/** {@link RichText} の props。Notion `rich_text` 配列 (annotations 含む) を受け取る。 */
export interface RichTextProps {
  value: ReadonlyArray<RichTextItemResponse>;
}

/**
 * Notion `rich_text` 配列を React のインライン要素として描画する。
 * bold / italic / strikethrough / underline / color / equation / mention を扱う。
 * カスタムブロックコンポーネント内で段落以外の rich_text を描画する際に利用する。
 *
 * @example
 * ```tsx
 * function CustomCallout({ block }: BlockComponentProps<CalloutBlockObjectResponse>) {
 *   return <aside><RichText value={block.callout.rich_text} /></aside>;
 * }
 * ```
 */
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
    const InlineEquation = components.InlineEquation ?? DefaultInlineEquation;
    const cachedHtml = (item.equation as EquationRichTextWithCachedHtml).__cachedHtml;
    return (
      <Annotated annotations={item.annotations} href={item.href}>
        <InlineEquation expression={item.equation.expression} cachedHtml={cachedHtml} />
      </Annotated>
    );
  }

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
