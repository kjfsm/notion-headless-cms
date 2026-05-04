"use client";

import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import { Annotated } from "./Annotation";
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
  if (item.type === "mention") {
    // mention 自身は色や bold を annotations で重ねがけできる
    return (
      <Annotated annotations={item.annotations} href={item.href}>
        <Mention item={item} />
      </Annotated>
    );
  }

  if (item.type === "equation") {
    return (
      <Annotated annotations={item.annotations} href={item.href}>
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          {item.equation.expression}
        </code>
      </Annotated>
    );
  }

  // text
  const url = item.text.link?.url ?? item.href ?? null;
  return (
    <Annotated annotations={item.annotations} href={url}>
      {item.text.content}
    </Annotated>
  );
}
