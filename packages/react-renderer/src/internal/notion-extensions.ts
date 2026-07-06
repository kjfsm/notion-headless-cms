import type {
  BookmarkBlockObjectResponse,
  CodeBlockObjectResponse,
  EquationBlockObjectResponse,
  EquationRichTextItemResponse,
  ImageBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { OgCardData } from "../embeds/OgCard.js";

/**
 * `@notion-headless-cms/cms` の同期パイプラインが焼き込む、Notion 公式型には
 * 存在しない拡張フィールド。各コンポーネントで個別にインラインキャストすると、
 * フィールド名を変更した際に型システムで検知できず実行時に静かに壊れるため、
 * この 1 箇所にまとめて定義する。
 */

/** shiki 等の事前レンダー拡張(`createShikiTransform`)が code ブロックに焼き込む、ハイライト済み HTML。 */
export type CodeWithCachedHtml = CodeBlockObjectResponse["code"] & {
  __cachedHtml?: string;
};

/** katex 等の事前レンダー拡張(`notion-katex` enricher)が equation ブロックに焼き込む、組版済み HTML。 */
export type EquationWithCachedHtml = EquationBlockObjectResponse["equation"] & {
  __cachedHtml?: string;
};

/** rich_text 内の equation アイテム(インライン数式)に対する同上の拡張。 */
export type EquationRichTextWithCachedHtml =
  EquationRichTextItemResponse["equation"] & {
    __cachedHtml?: string;
  };

/** 同期パイプライン(`resolveImageUrls`)が image ブロックに焼き込む画像寸法(CLS ゼロ化用)。 */
export type ImageWithDimensions = ImageBlockObjectResponse["image"] & {
  _dimensions?: { width: number | null; height: number | null };
};

/** 同期時に事前解決済みの OGP メタデータ(未取得ならクライアント側で `useOgp` にフォールバック)。 */
export type BookmarkWithOgp = BookmarkBlockObjectResponse & {
  ogp?: OgCardData;
};
