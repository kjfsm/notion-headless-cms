"use client";

import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";

import { RichText } from "./RichText";

/** {@link Caption} の props。`variant` で figure / block 配下のスタイルを切り替える。 */
export interface CaptionProps {
  value: ReadonlyArray<RichTextItemResponse>;
  /** figure 配下なら "figure" (中央寄せ figcaption)、card 等の文字下なら "block"。 */
  variant?: "figure" | "block";
}

/**
 * caption 配列を一貫したスタイルで描画する。空配列なら何も出さない。
 * Image / Video / Audio / File / Pdf / Bookmark / Embed の caption が共通で使う。
 *
 * @example
 * ```tsx
 * <figure>
 *   <img src={url} alt="" />
 *   <Caption value={block.image.caption} variant="figure" />
 * </figure>
 * ```
 *
 * @see {@link RichText} caption 内の rich_text 配列を描画する下位コンポーネント。
 */
export function Caption({ value, variant = "figure" }: CaptionProps) {
  if (value.length === 0) return null;
  const cls =
    variant === "figure"
      ? "mt-1 text-center text-sm text-muted-foreground"
      : "mt-1 text-sm text-muted-foreground";
  if (variant === "figure") {
    return (
      <figcaption className={cls}>
        <RichText value={value} />
      </figcaption>
    );
  }
  return (
    <p className={cls}>
      <RichText value={value} />
    </p>
  );
}
